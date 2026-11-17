import Link from "next/link";
import { randomUUID } from "node:crypto";
import { businessDate, cardReceivables, money, storeName, type RetailState } from "@/domain/retail";
import { reverseCardReceipt, saveCardReceipt } from "./actions";
import { DetailsDialog } from "./sale-dialog";
import { Submit } from "./submit";

const pageSize = 15;
const dateLabel = (date: string) => date ? date.split("-").reverse().join("/") : "—";

export function CardReconciliation({ state, filter, period, page, canReconcile }: {
  state: RetailState; filter: string; period: { from: string; to: string }; page?: string; canReconcile: boolean;
}) {
  const today = businessDate();
  const rows = cardReceivables(state).filter(({ entry }) =>
    (!filter || entry.store === filter) && entry.date >= period.from && entry.date <= period.to)
    .sort((a, b) => Number(b.open) - Number(a.open) || b.entry.date.localeCompare(a.entry.date));
  const total = rows.reduce((sum, row) => ({
    expected: sum.expected + row.expected, received: sum.received + row.received,
    pending: sum.pending + row.pending, difference: sum.difference + row.difference,
  }), { expected: 0, received: 0, pending: 0, difference: 0 });
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.max(1, Math.min(pages, /^\d{1,8}$/.test(page ?? "") ? Number(page) : 1));
  const href = (number: number) => "/admin?" + new URLSearchParams({
    tab: "caixa", caixaVisao: "cartao", loja: filter, inicio: period.from, fim: period.to, caixaPagina: String(number),
  });

  return <>
    <div className="metrics-grid" aria-label="Resumo dos cartões">
      <article className="panel metric"><span>Líquido previsto</span><strong>{money(total.expected)}</strong></article>
      <article className="panel metric"><span>A receber</span><strong>{money(total.pending)}</strong></article>
      <article className="panel metric"><span>Recebido registrado</span><strong>{money(total.received)}</strong></article>
      <article className="panel metric"><span>Diferença nos encerrados</span><strong>{money(total.difference)}</strong><small>Recebido menos previsto</small></article>
    </div>
    <section className="panel">
      <div className="panel-title"><h2>Recebimentos de cartão</h2></div>
      <form className="admin-form report-filter" action="/admin" method="get">
        <input type="hidden" name="tab" value="caixa" /><input type="hidden" name="caixaVisao" value="cartao" />
        <input type="hidden" name="loja" value={filter} />
        <label>Venda a partir de<input type="date" name="inicio" defaultValue={period.from} required /></label>
        <label>Venda até<input type="date" name="fim" defaultValue={period.to} required /></label>
        <div><button className="button" type="submit">Filtrar</button></div>
      </form>
      {rows.length ? <div className="table-wrap"><table>
        <thead><tr><th>Venda</th><th>Unidade</th><th>Previsão</th><th>Líquido previsto</th><th>Recebido</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{rows.slice((current - 1) * pageSize, current * pageSize).map(({ entry, sale, payment, expected, received, open, pending, difference }) => {
          const accounts = (state.cashAccounts ?? []).filter((item) => item.store === entry.store && item.kind === "Banco");
          const credits = entry.settlements.filter((item) => item.cashAmount !== undefined);
          const manuallyReconciled = credits.some((item) => !item.reversedOn);
          const context = <>
            <input type="hidden" name="filter" value={filter} /><input type="hidden" name="caixaVisao" value="cartao" />
            <input type="hidden" name="inicio" value={period.from} /><input type="hidden" name="fim" value={period.to} />
            <input type="hidden" name="caixaPagina" value={current} /><input type="hidden" name="entryId" value={entry.id} />
          </>;
          return <tr key={entry.id}>
            <td><strong>{sale.customer}</strong><small>{sale.productName} · {dateLabel(entry.date)}</small>
              {payment?.rate && <small>{payment.rate.mode} · {payment.rate.installments}×</small>}</td>
            <td>{storeName(entry.store, state)}</td><td>{dateLabel(entry.due)}</td><td>{money(expected)}</td>
            <td>{money(received)}{open && <small>Falta {money(pending)}</small>}</td>
            <td><span className="pill">{open ? received ? "Parcial" : "A receber" : difference ? "Com diferença" : manuallyReconciled ? "Conciliado" : "Baixa anterior"}</span>
              {!open && difference !== 0 && <small>{money(difference)}</small>}</td>
            <td>{open && canReconcile ? accounts.length ? <DetailsDialog id={"conciliar-" + entry.id} title="Confirmar crédito do cartão" trigger="Confirmar crédito">
              <form action={saveCardReceipt} className="admin-form">
                {context}
                <input type="hidden" name="token" value={randomUUID()} />
                <p className="form-note span-two">Saldo líquido previsto deste pagamento: <strong>{money(pending)}</strong></p>
                <label>Conta bancária<select name="accountId" required defaultValue="">
                  <option value="" disabled>Selecione</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
                </select></label>
                <label>Data do crédito<input type="date" name="date" defaultValue={today} min={entry.date} max={today} required /></label>
                <label>Como registrar<select name="mode"><option value="expected">Recebi o saldo previsto integral</option>
                  <option value="partial">Recebi parte e ainda falta um crédito</option><option value="close">Encerrar com o valor informado</option>
                </select></label>
                <label>Valor líquido recebido (R$)<input name="amount" inputMode="decimal" placeholder="Preencha para parcial ou encerramento" maxLength={32} /></label>
                <div className="span-two"><Submit>Registrar crédito</Submit></div>
              </form>
            </DetailsDialog> : <small>Cadastre uma conta bancária da unidade.</small> : !credits.length ? "—" : null}
            {credits.length > 0 && <DetailsDialog id={"creditos-" + entry.id} title="Créditos registrados" trigger="Ver créditos">
              <div className="sale-detail-content">
                {credits.map((credit) => <section className="sale-detail-card" key={credit.id}>
                  <h3>{money(credit.cashAmount ?? 0)} · {dateLabel(credit.date)}</h3>
                  {credit.reversedOn ? <p>Estornado em {dateLabel(credit.reversedOn)}</p> : canReconcile && <details>
                    <summary>Estornar crédito</summary>
                    <form action={reverseCardReceipt} className="admin-form">
                      {context}<input type="hidden" name="paymentId" value={credit.id} />
                      <label>Data do estorno<input type="date" name="date" min={credit.date} max={today} defaultValue={today} required /></label>
                      <div><Submit variant="danger">Confirmar estorno</Submit></div>
                    </form>
                  </details>}
                </section>)}
              </div>
            </DetailsDialog>}</td>
          </tr>;
        })}</tbody>
      </table></div> : <p className="admin-empty">Nenhum pagamento em cartão para estes filtros.</p>}
      {pages > 1 && <nav className="panel-title branch-filter" aria-label="Paginação dos recebimentos">
        {current > 1 && <Link href={href(current - 1)}>Anterior</Link>}<span>Página {current} de {pages}</span>
        {current < pages && <Link href={href(current + 1)}>Próxima</Link>}
      </nav>}
    </section>
  </>;
}
