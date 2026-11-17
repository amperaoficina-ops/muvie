import Link from "next/link";
import { businessDate, cashBalance, cashMovements, money, storeList, storeName, type RetailState } from "@/domain/retail";
import { assignCashMovement, reconcileCashAccount, recordCashAdjustment, saveCashAccount } from "./actions";
import { CreateDialog } from "./sale-dialog";
import { AttachmentPicker } from "./attachment-picker";
import styles from "./cash.module.css";

const statementPageSize = 15;

export function Cash({ state, filter, period, selected, page, direction }: {
  state: RetailState; filter: string; period: { from: string; to: string }; selected?: string; page?: string; direction?: "entradas" | "saidas";
}) {
  const today = businessDate();
  const units = storeList(state).filter((unit) => !filter || unit.id === filter);
  const accounts = (state.cashAccounts ?? []).filter((account) => !filter || account.store === filter);
  const account = accounts.find((item) => item.id === selected);
  const accountFilter = account?.id ?? (selected === "sem-conta" ? selected : "");
  const movements = cashMovements(state).filter((movement) => !filter || movement.store === filter);
  const pending = movements.filter((movement) => !movement.accountId && movement.date >= period.from && movement.date <= period.to);
  const periodMovements = movements.filter((movement) => movement.date >= period.from && movement.date <= period.to &&
    (!accountFilter || (accountFilter === "sem-conta" ? !movement.accountId : movement.accountId === accountFilter)));
  const rows = periodMovements.filter((movement) => !direction || (direction === "entradas" ? movement.amount > 0 : movement.amount < 0))
    .sort((a, b) => b.date.localeCompare(a.date));
  const pages = Math.max(1, Math.ceil(rows.length / statementPageSize));
  const current = Math.min(pages, /^\d{1,8}$/.test(page ?? "") ? Math.max(1, Number(page)) : 1);
  const reconciliations = (state.cashReconciliations ?? []).filter((row) => (!account || row.accountId === account.id) &&
    accounts.some((item) => item.id === row.accountId) && row.date >= period.from && row.date <= period.to);
  const href = (id: string, number = 1) => "/admin?" + new URLSearchParams({
    tab: "caixa", loja: filter, conta: id, inicio: period.from, fim: period.to, caixaPagina: String(number), ...(direction ? { caixaTipo: direction } : {}),
  });
  const context = <><input type="hidden" name="filter" value={filter} /><input type="hidden" name="conta" value={accountFilter} />
    <input type="hidden" name="inicio" value={period.from} /><input type="hidden" name="fim" value={period.to} /><input type="hidden" name="caixaTipo" value={direction ?? ""} /></>;
  const options = accounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {storeName(item.store, state)}</option>);
  return <>
    <div className="admin-filter-bar">
      <a className="button yellow" href="#nova-conta">＋ Nova conta</a>
      {accounts.length > 0 && <><a className="button" href="#conferir-caixa">Conferir extrato</a>
        <a className="button" href="#ajustar-caixa">Registrar movimento avulso</a></>}
    </div>
    <div className="metrics-grid" aria-label="Resumo do caixa">
      <article className="panel metric"><span>Saldo atual registrado</span><strong>{money((account ? [account] : accounts)
        .reduce((sum, item) => sum + cashBalance(item, movements, today), 0))}</strong><small>Saldos iniciais e baixas em contas</small></article>
      <article className="panel metric"><span>Entradas no período</span><strong>{money(periodMovements.reduce((sum, row) => sum + Math.max(0, row.amount), 0))}</strong></article>
      <article className="panel metric"><span>Saídas no período</span><strong>{money(periodMovements.reduce((sum, row) => sum + Math.max(0, -row.amount), 0))}</strong></article>
      <article className="panel metric"><span>Movimentos sem conta</span><strong>{pending.length}</strong><small><Link href={href("sem-conta")}>Ver movimentos no período</Link></small></article>
    </div>
    <section className="panel">
      <div className="panel-title"><h2>Contas da unidade</h2></div>
      <div className="metrics-grid">
        {accounts.map((item) => {
          const last = (state.cashReconciliations ?? []).filter((row) => row.accountId === item.id).sort((a, b) => b.date.localeCompare(a.date))[0];
          const days = last ? Math.floor((Date.parse(today) - Date.parse(last.date)) / 86400000) : null;
          return <Link className="panel metric" key={item.id} href={href(item.id)}>
            <span>{item.name} · {storeName(item.store, state)}</span><strong>{money(cashBalance(item, movements, today))}</strong>
            <small>{item.kind}{item.defaultAccount ? " · Conta padrão" : ""}{item.paymentMethod ? " · " + item.paymentMethod : ""}</small>
            <small>{days === null ? "Sem conferência" : days >= item.reviewDays ? "Conferência pendente" : days < 1 ? "Conferida hoje" : `Última conferência há ${days} dia(s)`}</small>
          </Link>;
        })}
      </div>
      {!accounts.length && <p className="admin-empty">Cadastre uma conta bancária ou um caixa físico para esta unidade.</p>}
    </section>
    <section id="extrato-caixa" className="panel">
      <div className="panel-title"><h2>Extrato do sistema</h2></div>
      <form className={"admin-form " + styles.filters} action="/admin#extrato-caixa" method="get" key={accountFilter + period.from + period.to + direction}>
        <input type="hidden" name="tab" value="caixa" /><input type="hidden" name="loja" value={filter} />
        <label>Conta<select name="conta" defaultValue={accountFilter}><option value="">Todas as contas</option><option value="sem-conta">Sem conta</option>{options}</select></label>
        <label>De<input type="date" name="inicio" defaultValue={period.from} required /></label>
        <label>Até<input type="date" name="fim" defaultValue={period.to} required /></label>
        <label>Movimento<select name="caixaTipo" defaultValue={direction ?? ""}>
          <option value="">Entradas e saídas</option><option value="entradas">Só entradas</option><option value="saidas">Só saídas</option>
        </select></label>
        <div><button className="button" type="submit">Filtrar</button></div>
      </form>
      {rows.length ? <div className="table-wrap"><table><thead><tr><th>Data</th><th>Movimento</th><th>Unidade</th><th>Valor</th><th>Conta</th></tr></thead>
        <tbody>{rows.slice((current - 1) * statementPageSize, current * statementPageSize).map((row) => {
          const eligible = accounts.filter((item) => item.store === row.store && row.postedDate && row.postedDate >= item.openingDate);
          return <tr key={row.key + ":" + row.reversal}><td>{row.date.split("-").reverse().join("/")}</td>
            <td>{row.name}{row.reversal && <small>Estorno</small>}</td><td>{storeName(row.store, state)}</td><td>{money(row.amount)}</td>
            <td>{!row.reversal && eligible.length > 0 ? <form action={assignCashMovement} className={styles.assignment}>
              {context}<input type="hidden" name="caixaPagina" value={current} /><input type="hidden" name="entryId" value={row.entryId} /><input type="hidden" name="settlementId" value={row.settlementId} />
              <select name="accountId" aria-label={`Conta de ${row.name}`} defaultValue={row.accountId ?? ""} required>
                <option value="" disabled>Sem conta</option>{eligible.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select><button className="button yellow" type="submit">Vincular</button>
            </form> : accounts.find((item) => item.id === row.accountId)?.name ?? "Sem conta elegível"}</td>
          </tr>;
        })}</tbody></table></div> : <p className="admin-empty">Nenhum movimento para estes filtros.</p>}
      {pages > 1 && <nav className="panel-title branch-filter" aria-label="Paginação do extrato">
        {current > 1 && <Link href={href(accountFilter, current - 1)}>Anterior</Link>}
        <span>Página {current} de {pages}</span>
        {current < pages && <Link href={href(accountFilter, current + 1)}>Próxima</Link>}
      </nav>}
    </section>
    <section className="panel">
      <div className="panel-title"><h2>Conciliações no período</h2></div>
      {reconciliations.length ? <div className="table-wrap"><table><thead><tr><th>Data</th><th>Conta</th><th>Sistema na conferência</th><th>Extrato</th><th>Diferença atual</th><th>Registro</th><th>Ações</th></tr></thead>
        <tbody>{reconciliations.map((row) => {
          const item = accounts.find((item) => item.id === row.accountId)!;
          const difference = row.statementBalance - cashBalance(item, movements, row.date);
          return <tr key={row.id}><td>{row.date.split("-").reverse().join("/")}</td><td>{item.name} · {storeName(item.store, state)}</td>
            <td>{money(row.systemBalance)}</td><td>{money(row.statementBalance)}</td>
            <td><span className="pill">{difference ? money(difference) : "Conciliado"}</span></td><td>{row.actor}{row.notes && <small>{row.notes}</small>}</td>
            <td><Link className="back-link" href={"/admin?" + new URLSearchParams({
              tab: "caixa", loja: item.store, conta: item.id, inicio: item.openingDate, fim: row.date,
            }) + "#extrato-caixa"}>Ver extrato até a data</Link>
            {row.statementName && <small><Link className="back-link" href={"/admin/caixa/extratos/" + row.id}>Baixar anexo · {row.statementName}</Link></small>}</td></tr>;
        })}</tbody></table></div> : <p className="admin-empty">Nenhuma conferência registrada no período.</p>}
    </section>
    <CreateDialog id="nova-conta" title="Nova conta" reopen={false}><form action={saveCashAccount} className="admin-form">
      {context}
      <label>Nome da conta<input name="name" required maxLength={80} placeholder="Ex. Itaú ou Caixa da loja" /></label>
      <label>Unidade<select name="store" defaultValue={filter} required><option value="" disabled>Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
      <label>Tipo<select name="kind"><option>Banco</option><option>Dinheiro</option></select></label>
      <label>Receber automaticamente<select name="paymentMethod"><option value="">Sem regra por forma de pagamento</option>{["Pix", "Cartão", "Dinheiro", "Financiamento"].map((method) => <option key={method}>{method}</option>)}</select></label>
      <label>Data inicial<input type="date" name="openingDate" defaultValue={today} max={today} required /></label>
      <label>Conferir a cada quantos dias<input type="number" name="reviewDays" defaultValue={7} min={1} max={365} required /></label>
      <label>Saldo no início da data<input name="openingBalance" defaultValue="0,00" required /></label>
      <p className="form-note span-two">Use o saldo antes dos movimentos da data inicial. A primeira conta da unidade recebe automaticamente as baixas sem outra regra. Você pode corrigir o vínculo pelo extrato.</p>
      <div className="span-two"><button className="button yellow" type="submit">Cadastrar conta</button></div>
    </form></CreateDialog>
    <CreateDialog id="conferir-caixa" title="Conferir extrato" reopen={false}><form action={reconcileCashAccount} className="admin-form">
      {context}<label>Conta<select name="accountId" defaultValue={account?.id ?? ""} required><option value="" disabled>Selecione</option>{options}</select></label>
      <label>Data de referência<input type="date" name="date" defaultValue={today} max={today} required /></label>
      <label>Saldo de fechamento no extrato<input name="statementBalance" placeholder="0,00" required /></label>
      <label className="span-two">Observações<textarea name="notes" maxLength={500} /></label>
      <div className="span-two"><AttachmentPicker name="statement" label="Anexar extrato" accept=".pdf,.jpg,.jpeg,.png,.webp"
        hint="Opcional. PDF, JPG, PNG ou WebP de até 8 MB." /></div>
      <p className="form-note span-two">Confira a mesma conta e data no extrato do sistema. Se houver diferença, revise baixas, taxas, vínculos e lançamentos faltantes antes de registrar um ajuste.</p>
      <div className="span-two"><button className="button yellow" type="submit">Salvar conferência</button></div>
    </form></CreateDialog>
    <CreateDialog id="ajustar-caixa" title="Movimento avulso" reopen={false}><form action={recordCashAdjustment} className="admin-form">
      {context}<label>Conta<select name="accountId" defaultValue={account?.id ?? ""} required><option value="" disabled>Selecione</option>{options}</select></label>
      <label>Data<input type="date" name="date" defaultValue={today} max={today} required /></label>
      <label>Tipo<select name="direction"><option value="in">Entrada</option><option value="out">Saída</option></select></label>
      <label>Valor<input name="amount" inputMode="decimal" required placeholder="0,00" /></label>
      <label className="span-two">Motivo<input name="name" maxLength={120} required /></label>
      <p className="form-note span-two">Use para um movimento sem lançamento de origem. Afeta o caixa da unidade.</p>
      <div className="span-two"><button className="button yellow" type="submit">Registrar movimento</button></div>
    </form></CreateDialog>
  </>;
}
