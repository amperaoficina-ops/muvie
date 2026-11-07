import { randomUUID } from "node:crypto";
import Link from "next/link";
import { balanceDue, businessDate, financialReport, isCalendarDate, money, salesRanking, storeName, stores,
  type Asset, type FixedCost, type LedgerEntry, type RetailState, type Staff, type StoreId } from "@/domain/retail";
import { launchMonth, saveLedgerEntry, saveStoreItem, updateLedger } from "./actions";
import { Submit } from "./submit";

type Filter = StoreId | "";
type Period = { from: string; to: string };
const today = () => businessDate();
const shortDate = (date: string) => date ? date.split("-").reverse().join("/") : "A definir";
const totalOf = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((sum, row) => sum + value(row), 0);
const labels: Record<LedgerEntry["kind"], string> = {
  venda: "Venda", estoque: "Compra de estoque", consignacao: "Repasse consignado", comissao: "Comissão",
  fixo: "Custo fixo", salario: "Salário", despesa: "Despesa", "outra-receita": "Outra receita", ajuste: "Ajuste de caixa",
};

export function reportPeriod(from?: string, to?: string): Period {
  const now = today();
  const fallback = { from: now.slice(0, 7) + "-01", to: now };
  if (!from || !to || !isCalendarDate(from) || !isCalendarDate(to) || from > to) return fallback;
  return { from, to };
}

function HiddenFilter({ filter }: { filter: Filter }) {
  return <input type="hidden" name="filter" value={filter} />;
}

function PeriodFilter({ period, filter, tab }: { period: Period; filter: Filter; tab: string }) {
  return <form className="admin-form report-filter panel" method="get" action="/admin">
    <input type="hidden" name="tab" value={tab} />
    <input type="hidden" name="loja" value={filter} />
    <label>De<input type="date" name="inicio" defaultValue={period.from} required /></label>
    <label>Até<input type="date" name="fim" defaultValue={period.to} required /></label>
    <button className="button yellow">Aplicar período</button>
  </form>;
}

function RankChart({ title, rows }: { title: string; rows: ReturnType<typeof salesRanking> }) {
  const top = rows.slice(0, 8);
  const max = top[0]?.units ?? 1;
  return <section className="panel"><div className="panel-title"><h2>{title}</h2><span className="pill">POR UNIDADES</span></div>
    <div className="bar-chart">{top.length ? top.map((row, index) => <div className="ranking-row" key={index}>
      <span>{row.label}</span><div className="bar-track" aria-hidden="true"><i style={{ width: (row.units / max * 100) + "%" }} /></div>
      <strong>{row.units} un.</strong><small>{money(row.amount)}</small>
    </div>) : <p className="form-note">Sem vendas correspondentes no período.</p>}</div>
  </section>;
}

export function Rankings({ state, filter, period, admin }: { state: RetailState; filter: Filter; period: Period; admin: boolean }) {
  const selected = filter || undefined;
  const report = admin ? financialReport(state, period.from, period.to, selected) : null;
  return <>
    <PeriodFilter period={period} filter={filter} tab="visao" />
    <div className="overview-grid">
      <RankChart title="Modelos mais vendidos" rows={salesRanking(state, period.from, period.to, selected)} />
      <RankChart title="Vendas por vendedor" rows={salesRanking(state, period.from, period.to, selected, true)} />
    </div>
    {report && <div className="metrics-grid">
      <Metric name="Custos e despesas do período" value={report.cost + report.commissions + report.fixed + report.salary + report.expenses} />
      <Metric name="A pagar em aberto" value={report.payable} />
      <Metric name="A receber em aberto" value={report.receivable} />
      <Metric name="Movimento líquido de caixa" value={report.cash} />
    </div>}
  </>;
}

function Metric({ name, value }: { name: string; value: number }) {
  return <div className="panel metric"><span>{name}</span><strong>{money(value)}</strong></div>;
}

export function StoresPanel({ state, filter, showSales }: { state: RetailState; filter: Filter; showSales: boolean }) {
  const active = filter;
  const staff = state.staff.filter((item) => item.store === active);
  const fixed = state.fixedCosts.filter((item) => item.store === active);
  const assets = state.assets.filter((item) => item.store === active);
  return <>
    {!active && <div className="metrics-grid">
      <Metric name="Fixos mensais · todas as lojas" value={totalOf(state.fixedCosts.filter((item) => item.active), (item) => item.amount)} />
      <Metric name="Salários mensais · todas as lojas" value={totalOf(state.staff.filter((item) => item.active), (item) => item.salary)} />
    </div>}
    <div className="overview-grid">{stores.filter((store) => !active || store.id === active).map((store) => {
      const costs = totalOf(state.fixedCosts.filter((item) => item.store === store.id && item.active), (item) => item.amount);
      const team = state.staff.filter((item) => item.store === store.id && item.active);
      return <section key={store.id} className="panel"><div className="panel-title"><h2>{store.name}</h2><Link className="back-link" href={"/admin?tab=lojas&loja=" + store.id}>{active === store.id ? "Unidade selecionada" : "Abrir unidade →"}</Link></div>
        <div className="bar-chart"><span>{team.length} pessoa(s) na equipe</span><span>Fixos mensais · <strong>{money(costs)}</strong></span>
          <span>Salários cadastrados · <strong>{money(totalOf(team, (item) => item.salary))}</strong></span>
          {showSales && <Link className="back-link" href={"/admin?tab=vendas&loja=" + store.id}>Consultar vendas desta loja →</Link>}
        </div>
      </section>;
    })}</div>
    {!active ? <p className="admin-empty panel">Selecione São José ou Palhoça para editar equipe, custos fixos e estrutura ou lançar a competência mensal.</p> : <>
    <section className="panel"><div className="panel-title"><h2>Competência mensal · {storeName(active)}</h2></div>
      <form className="admin-form" action={launchMonth}><HiddenFilter filter={active} /><input type="hidden" name="store" value={active} />
        <label>Mês de referência<input name="month" type="month" defaultValue={today().slice(0, 7)} required /></label>
        <div><Submit>Lançar fixos e salários</Submit></div>
        <p className="form-note span-two">Gera compromissos mensais uma vez por cadastro. Depois, registre as baixas no Financeiro.</p>
      </form>
    </section>
    <StoreSection title="Equipe e vendedores" kind="staff" store={active} items={staff} />
    <StoreSection title="Custos fixos" kind="fixed" store={active} items={fixed} />
    <StoreSection title="Estrutura da loja" kind="asset" store={active} items={assets} />
    </>}
  </>;
}

type StoreItem = Staff | FixedCost | Asset;
type StoreKind = "staff" | "fixed" | "asset";
function StoreSection({ title, kind, store, items }: { title: string; kind: StoreKind; store: StoreId; items: StoreItem[] }) {
  return <section className="panel"><div className="panel-title"><h2>{title} · {storeName(store)}</h2></div>
    <div className="editable-list">{items.map((item) => <details key={item.id}><summary><span><strong>{item.name}</strong>
      <small>{"job" in item ? item.job + " · " + money(item.salary) + " · " + (item.commissionBps / 100) + "% de comissão"
        : "quantity" in item ? item.quantity + " un. · " + money(item.amount) : money(item.amount) + " / mês · dia " + item.day}
      {"active" in item && !item.active && " · Inativo"}</small></span></summary><StoreItemForm kind={kind} store={store} item={item} /></details>)}
      <details><summary><span>＋ Adicionar cadastro</span></summary><StoreItemForm kind={kind} store={store} /></details>
    </div>
  </section>;
}

function Currency({ name, label, value, required = false }: { name: string; label: string; value?: number; required?: boolean }) {
  return <label>{label}<input name={name} type="number" min={required ? ".01" : "0"} step=".01" max="99999999.99" required={required} defaultValue={value == null ? "" : value / 100} /></label>;
}

function StoreItemForm({ kind, store, item }: { kind: StoreKind; store: StoreId; item?: StoreItem }) {
  const staff = item && "job" in item ? item : undefined;
  const fixed = item && "day" in item ? item : undefined;
  const asset = item && "quantity" in item ? item : undefined;
  return <form className="admin-form" action={saveStoreItem}>
    <HiddenFilter filter={store} /><input type="hidden" name="store" value={store} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item?.id ?? ""} />
    <label>Nome<input name="name" maxLength={100} defaultValue={item?.name} required /></label>
    {kind === "staff" && <>
      <label>Cargo<input name="job" maxLength={70} defaultValue={staff?.job ?? "Vendedor"} required /></label>
      <Currency name="salary" label="Salário mensal (R$)" value={staff?.salary} />
      <label>Comissão sobre a venda (%)<input name="commission" type="number" min="0" max="100" step=".01" defaultValue={staff ? staff.commissionBps / 100 : 0} /></label>
    </>}
    {kind === "fixed" && <>
      <Currency name="amount" label="Valor mensal (R$)" value={fixed?.amount} required />
      <label>Dia do vencimento<input name="day" type="number" min="1" max="31" defaultValue={fixed?.day ?? 10} required /></label>
    </>}
    {kind === "asset" ? <>
      <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue={asset?.quantity ?? 1} required /></label>
      <Currency name="amount" label="Valor total de aquisição (R$)" value={asset?.amount} />
      <label className="span-two">Localização / observações<textarea name="notes" defaultValue={asset?.notes} maxLength={500} /></label>
    </> : <label className="checkbox span-two"><input name="active" type="checkbox" defaultChecked={staff?.active ?? fixed?.active ?? true} /> Cadastro ativo</label>}
    <div className="span-two"><Submit>Salvar cadastro</Submit></div>
  </form>;
}

export function Finance({ state, filter, period }: { state: RetailState; filter: Filter; period: Period }) {
  const report = financialReport(state, period.from, period.to, filter || undefined);
  const entries = state.ledger.filter((item) => !filter || item.store === filter);
  const open = entries.filter((item) => balanceDue(item) > 0).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const closed = entries.filter((item) => balanceDue(item) === 0 && item.settlements.some((row) => row.date >= period.from && row.date <= period.to || !!row.reversedOn && row.reversedOn >= period.from && row.reversedOn <= period.to));
  const rows: [string, number][] = [
    ["Receita líquida de descontos", report.revenue], ["Outras receitas", report.other], ["Custo das motos e produtos vendidos", -report.cost],
    ["Comissões", -report.commissions], ["Salários lançados", -report.salary], ["Fixos lançados", -report.fixed], ["Outras despesas", -report.expenses],
  ];
  return <>
    <PeriodFilter tab="financeiro" filter={filter} period={period} />
    <div className="metrics-grid"><Metric name="A pagar em aberto" value={report.payable} /><Metric name="A receber em aberto" value={report.receivable} />
      <Metric name="Contas a pagar vencidas" value={report.overdue} /><Metric name="Caixa líquido no período" value={report.cash} /></div>
    <div className="overview-grid">
      <section className="panel"><div className="panel-title"><h2>DRE gerencial por competência</h2></div><dl className="finance-rows">
        {rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{money(value)}</dd></div>)}
        <div><dt><strong>Resultado {report.missingSales ? "parcial" : "gerencial"}</strong></dt><dd><strong>{money(report.result)}</strong></dd></div>
      </dl>{report.missingSales > 0 && <p className="feedback error">{report.missingSales} venda(s) ou estorno(s) sem custo completo registrado neste período.</p>}</section>
      <section className="panel"><div className="panel-title"><h2>Fluxo de caixa por data da baixa</h2></div>
        <dl className="finance-rows"><div><dt>Entradas recebidas</dt><dd>{money(report.incoming)}</dd></div><div><dt>Saídas pagas</dt><dd>{money(report.outgoing)}</dd></div>
          <div><dt><strong>Movimento líquido</strong></dt><dd><strong>{money(report.cash)}</strong></dd></div></dl>
        <p className="admin-empty">As contas em aberto mostram todos os vencimentos. O período filtra o DRE, as baixas e os estornos.</p>
      </section>
    </div>
    <section className="panel"><div className="panel-title"><h2>Novo compromisso</h2></div>
      <form className="admin-form" action={saveLedgerEntry}><HiddenFilter filter={filter} /><input type="hidden" name="entryId" value={randomUUID()} />
        <input type="hidden" name="inicio" value={period.from} /><input type="hidden" name="fim" value={period.to} />
        <label>Descrição<input name="name" maxLength={120} required placeholder="Ex.: internet, impostos ou serviço prestado" /></label>
        <label>Unidade<select name="store" defaultValue={filter} required><option value="">Selecione</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        <label>Tipo<select name="direction"><option value="out">A pagar · despesa</option><option value="in">A receber · outra receita</option></select></label>
        <label>Classificação<select name="classification"><option value="operacional">Operacional · DRE e caixa</option><option value="somente-caixa">Somente caixa · ex.: aporte ou investimento</option></select></label>
        <Currency name="amount" label="Valor (R$)" required />
        <label>Data de competência<input type="date" name="date" defaultValue={today()} required /></label>
        <label>Vencimento<input type="date" name="due" required /></label>
        <div className="span-two"><Submit>Lançar compromisso</Submit></div>
      </form>
    </section>
    <LedgerList title="Compromissos em aberto" entries={open} filter={filter} period={period} />
    <LedgerList title="Compromissos encerrados com movimentação no período" entries={closed} filter={filter} period={period} />
  </>;
}

function LedgerList({ title, entries, filter, period }: { title: string; entries: LedgerEntry[]; filter: Filter; period: Period }) {
  return <section className="panel"><div className="panel-title"><h2>{title}</h2></div>
    <div className="editable-list">{entries.length ? entries.map((entry) => <details key={entry.id}>
      <summary><span><strong>{entry.name}</strong><small>{storeName(entry.store)} · {labels[entry.kind]} · vence {shortDate(entry.due)}</small></span>
        <span className="pill">{entry.canceled ? "Cancelado" : balanceDue(entry) ? (entry.direction === "in" ? "A receber" : "A pagar") : "Baixado"}</span>
        <strong>{money(balanceDue(entry) || entry.amount)}</strong></summary>
      {!entry.canceled && balanceDue(entry) > 0 && <>
        <LedgerForm entry={entry} filter={filter} period={period} mode="pay" />
        <LedgerForm entry={entry} filter={filter} period={period} mode="schedule" />
      </>}
      {entry.settlements.map((payment) => <div className="record-actions" key={payment.id}>
        <p>Baixa de {money(payment.amount)} em {shortDate(payment.date)}{payment.reversedOn ? " · Estornada em " + shortDate(payment.reversedOn) : ""}</p>
        {!entry.canceled && (entry.kind !== "ajuste" || entry.manual) && !payment.reversedOn && <details><summary>Registrar estorno da baixa</summary>
          <LedgerForm entry={entry} filter={filter} period={period} mode="reverse" settlementId={payment.id} />
        </details>}
      </div>)}
      {!entry.canceled && entry.manual && entry.settlements.every((payment) => payment.reversedOn) &&
        <details className="record-actions"><summary>Cancelar compromisso manual</summary><LedgerForm entry={entry} filter={filter} period={period} mode="cancel" /></details>}
    </details>) : <p className="admin-empty">Nenhum compromisso nesta lista.</p>}</div>
  </section>;
}

function LedgerForm({ entry, filter, period, mode, settlementId }: { entry: LedgerEntry; filter: Filter; period: Period; mode: string; settlementId?: string }) {
  return <form className="admin-form" action={updateLedger}>
    <HiddenFilter filter={filter} /><input type="hidden" name="inicio" value={period.from} /><input type="hidden" name="fim" value={period.to} />
    <input type="hidden" name="id" value={entry.id} /><input type="hidden" name="mode" value={mode} />
    {mode === "pay" && <><input type="hidden" name="paymentId" value={randomUUID()} /><Currency name="amount" label="Valor desta baixa (R$)" value={balanceDue(entry)} required /></>}
    {settlementId && <input type="hidden" name="settlementId" value={settlementId} />}
    {mode !== "cancel" && <label>{mode === "schedule" ? "Novo vencimento" : mode === "reverse" ? "Data do estorno" : "Data da baixa"}
      <input name="date" type="date" defaultValue={mode === "schedule" ? entry.due : today()} required /></label>}
    <div><Submit>{mode === "schedule" ? "Atualizar vencimento" : mode === "reverse" ? "Confirmar estorno" : mode === "cancel" ? "Confirmar cancelamento" : "Registrar baixa"}</Submit></div>
  </form>;
}
