import { CommitmentFrequency } from "./commitment-frequency";
import { CreateDialog, DetailsDialog } from "./sale-dialog";
import { SearchSelect } from "./search-select";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { balanceDue, businessDate, financialReport, isCalendarDate, isFixedCommitment, settledAmount, money, modelMarginRanking, salesRanking, storeName, storeList,
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
  fixo: "Custo fixo", salario: "Salário", despesa: "Despesa", "outra-receita": "Outra receita", ajuste: "Ajuste de caixa", "distribuicao-lucro": "Distribuição de lucro",
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
  const end = today();
  const presets = [
    { label: "Este mês", from: end.slice(0, 7) + "-01" },
    ...[7, 60, 90].map((days) => {
      const date = new Date(end + "T00:00:00Z");
      date.setUTCDate(date.getUTCDate() - (days - 1));
      return { label: "Últimos " + days + " dias", from: date.toISOString().slice(0, 10) };
    }),
  ];
  const active = presets.find((preset) => preset.from === period.from && end === period.to);
  return <section className="panel" aria-label="Filtrar por período">
    <div className="panel-title">
      <nav className="stock-category-filter" aria-label="Períodos rápidos">
        {presets.map((preset) => <Link key={preset.label} aria-current={active === preset ? "page" : undefined}
          href={"/admin?" + new URLSearchParams({ tab, loja: filter, inicio: preset.from, fim: end })}>{preset.label}</Link>)}
      </nav>
    </div>
    <form className="admin-form report-filter" method="get" action="/admin" key={period.from + period.to}>
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="loja" value={filter} />
      <label>De<input type="date" name="inicio" defaultValue={period.from} required /></label>
      <label>Até<input type="date" name="fim" defaultValue={period.to} required /></label>
      <button className="button yellow">Aplicar período</button>
    </form>
  </section>;
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

export function Rankings({ state, filter, period, admin, showSales }: { state: RetailState; filter: Filter; period: Period; admin: boolean; showSales: boolean }) {
  if (!showSales) return null;
  const selected = filter || undefined;
  return <>
    {admin && <section className="panel">
      <div className="panel-title"><h2>Margem por modelo</h2></div>
      <dl className="finance-rows">{modelMarginRanking(state, period.from, period.to, selected).slice(0, 8).map((row) =>
        <div key={row.label}><dt>{row.label}</dt><dd>{money(row.margin)}</dd></div>)}</dl>
      <p className="admin-empty">Receita menos custo, taxas de cartão, impostos, comissão e brindes rateados pelo valor dos itens vendidos. Considera vendas com custo completo.</p>
    </section>}
    <div className="overview-grid">
      <RankChart title="Modelos mais vendidos" rows={salesRanking(state, period.from, period.to, selected)} />
      <RankChart title="Vendas por vendedor" rows={salesRanking(state, period.from, period.to, selected, true)} />
    </div>
  </>;
}

export function OverviewFinance({ state, filter, period, admin }: { state: RetailState; filter: Filter; period: Period; admin: boolean }) {
  const selected = filter || undefined;
  const report = admin ? financialReport(state, period.from, period.to, selected) : null;
  return <>
    <PeriodFilter period={period} filter={filter} tab="visao" />
    {report && <section className="panel">
      <div className="panel-title"><h2>Lucro e caixa por loja</h2></div>
      <div className="table-wrap"><table><thead><tr>
        <th scope="col">Unidade</th><th scope="col">Lucro líquido no período</th>
        <th scope="col">Movimento de caixa no período</th><th scope="col">Caixa acumulado até {period.to.split("-").reverse().join("/")}</th>
      </tr></thead><tbody>
        {(filter ? storeList(state).filter((store) => store.id === filter) : storeList(state)).map((store) => {
          const unit = financialReport(state, period.from, period.to, store.id);
          const accumulated = financialReport(state, "0000-01-01", period.to, store.id);
          return <tr key={store.id}><th scope="row">{storeName(store.id, state)}</th>
            <td><strong>{money(unit.result)}</strong>{unit.missingSales > 0 && <small>Parcial · {unit.missingSales} sem custo completo</small>}</td>
            <td>{money(unit.cash)}</td><td><strong>{money(accumulated.cash)}</strong></td></tr>;
        })}
        {!filter && <tr><th scope="row">Todas as lojas</th>
          <td><strong>{money(report.result)}</strong>{report.missingSales > 0 && <small>Parcial · {report.missingSales} sem custo completo</small>}</td>
          <td>{money(report.cash)}</td><td><strong>{money(financialReport(state, "0000-01-01", period.to).cash)}</strong></td>
        </tr>}
      </tbody></table></div>
      <p className="admin-empty">O lucro segue o DRE gerencial. O caixa usa os recebimentos, pagamentos e estornos registrados.</p>
    </section>}
    {report && <div className="metrics-grid">
      <Metric name="Custos e despesas do período" value={report.cost + report.cardFees + report.taxes + report.commissions + report.fixed + report.salary + report.expenses} />
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
    <div className="overview-grid">{storeList(state).filter((store) => !active || store.id === active).map((store) => {
      const costs = totalOf(state.fixedCosts.filter((item) => item.store === store.id && item.active), (item) => item.amount);
      const team = state.staff.filter((item) => item.store === store.id && item.active);
      return <section key={store.id} className="panel"><div className="panel-title"><h2>{store.name}</h2><Link className="back-link" href={"/admin?tab=lojas&loja=" + store.id}>{active === store.id ? "Unidade selecionada" : "Abrir unidade →"}</Link></div>
        <div className="bar-chart"><span>{team.length} pessoa(s) na equipe</span><span>Fixos mensais · <strong>{money(costs)}</strong></span>
          <span>Salários cadastrados · <strong>{money(totalOf(team, (item) => item.salary))}</strong></span>
          {showSales && <Link className="back-link" href={"/admin?tab=vendas&loja=" + store.id}>Consultar vendas desta loja →</Link>}
        </div>
      </section>;
    })}</div>
    {!active ? <p className="admin-empty panel">Selecione uma unidade para editar equipe, custos fixos e estrutura ou lançar a competência mensal.</p> : <>
    <section className="panel"><div className="panel-title"><h2>Competência mensal · {storeName(active, state)}</h2></div>
      <form className="admin-form" action={launchMonth}><HiddenFilter filter={active} /><input type="hidden" name="store" value={active} />
        <label>Mês de referência<input name="month" type="month" defaultValue={today().slice(0, 7)} required /></label>
        <div><Submit>Lançar fixos e salários</Submit></div>
        <p className="form-note span-two">Gera compromissos mensais uma vez por cadastro. Depois, registre as baixas no Financeiro.</p>
      </form>
    </section>
    <StoreSection title="Equipe e vendedores" kind="staff" state={state} store={active} items={staff} />
    <StoreSection title="Custos fixos" kind="fixed" state={state} store={active} items={fixed} />
    <StoreSection title="Estrutura da loja" kind="asset" state={state} store={active} items={assets} />
    </>}
  </>;
}

type StoreItem = Staff | FixedCost | Asset;
type StoreKind = "staff" | "fixed" | "asset";
function StoreSection({ title, kind, store, items, state }: { state: RetailState; title: string; kind: StoreKind; store: StoreId; items: StoreItem[] }) {
  return <section className="panel"><div className="panel-title"><h2>{title} · {storeName(store, state)}</h2></div>
    <div className="editable-list">{items.map((item) => <details name={`store-${store}-${kind}`} key={item.id}><summary><span><strong>{item.name}</strong>
      <small>{"job" in item ? item.job + " · " + money(item.salary) + " · " + (item.commissionBps / 100) + "% de comissão"
        : "quantity" in item ? item.quantity + " un. · " + money(item.amount) : money(item.amount) + " / mês · dia " + item.day}
      {"active" in item && !item.active && " · Inativo"}</small></span></summary><StoreItemForm kind={kind} store={store} item={item} /></details>)}
      <details name={`store-${store}-${kind}`}><summary><span>＋ Adicionar cadastro</span></summary><StoreItemForm kind={kind} store={store} /></details>
    </div>
  </section>;
}

function Currency({ name, label, value, required = false }: { name: string; label: string; value?: number; required?: boolean }) {
  return <label>{label}<input name={name} type="number" min={required ? ".01" : "0"} step=".01" max="99999999.99" required={required} defaultValue={value == null ? "" : value / 100} /></label>;
}

export function StoreItemForm({ kind, store, item, staffPage = false, units = [], returnFilter = store }: { kind: StoreKind; store: StoreId; item?: StoreItem; staffPage?: boolean; units?: ReturnType<typeof storeList>; returnFilter?: string }) {
  const staff = item && "job" in item ? item : undefined;
  const fixed = item && "day" in item ? item : undefined;
  const asset = item && "quantity" in item ? item : undefined;
  return <form className="admin-form" action={saveStoreItem}>
    <HiddenFilter filter={returnFilter} />{staffPage && <><input type="hidden" name="staffPage" value="1" />{item && <input type="hidden" name="focus" value={item.id} />}</>}
    {staffPage && !item ? <label>Unidade<select name="store" defaultValue={store} required>
      <option value="" disabled>Selecione a unidade</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </select></label> : <input type="hidden" name="store" value={store} />}<input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item?.id ?? ""} />
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
  const rows: [string, number][] = [
    ["Receita líquida de descontos", report.revenue], ["Outras receitas", report.other], ["Custo das motos e produtos vendidos", -report.cost],
    ["Impostos sobre vendas", -report.taxes], ["Taxas de cartão", -report.cardFees], ["Comissões", -report.commissions], ["Salários lançados", -report.salary], ["Fixos lançados", -report.fixed], ["Outras despesas", -report.expenses],
  ];
  return <>
    <PeriodFilter tab="financeiro" filter={filter} period={period} />
    <div className="metrics-grid"><Metric name="A pagar em aberto" value={report.payable} /><Metric name="A receber em aberto" value={report.receivable} />
      <Metric name="Contas a pagar vencidas" value={report.overdue} /><Metric name="Caixa líquido no período" value={report.cash} /></div>
    <div className="overview-grid">
      <section className="panel"><div className="panel-title"><h2>DRE gerencial por competência</h2></div><dl className="finance-rows">
        {rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{money(value)}</dd></div>)}
        <div><dt><strong>Resultado {report.missingSales ? "parcial" : "gerencial"}</strong></dt><dd><strong>{money(report.result)}</strong></dd></div>
        <div><dt>Distribuição de lucro</dt><dd>{money(-report.distributions)}</dd></div>
        <div><dt><strong>Resultado após distribuição</strong></dt><dd><strong>{money(report.result - report.distributions)}</strong></dd></div>
      </dl>{report.missingSales > 0 && <p className="feedback error">{report.missingSales} venda(s) ou estorno(s) sem custo completo registrado neste período.</p>}</section>
      <section className="panel"><div className="panel-title"><h2>Fluxo de caixa por data da baixa</h2></div>
        <dl className="finance-rows"><div><dt>Entradas recebidas</dt><dd>{money(report.incoming)}</dd></div><div><dt>Saídas pagas</dt><dd>{money(report.outgoing)}</dd></div>
          <div><dt><strong>Movimento líquido</strong></dt><dd><strong>{money(report.cash)}</strong></dd></div></dl>
        <p className="admin-empty">As contas em aberto mostram todos os vencimentos. O período filtra o DRE, as baixas e os estornos.</p>
      </section>
    </div>
  </>;
}

type CommitmentFilters = { kind?: string; deadline?: string; view?: string; paidFrom?: string; paidTo?: string };

function commitmentFilterParams({ kind, deadline, view, paidFrom, paidTo }: CommitmentFilters) {
  return {
    ...(kind ? { tipoCompromisso: kind } : {}), ...(deadline ? { prazoCompromisso: deadline } : {}),
    ...(view ? { compromissosVisao: view } : {}),
    ...(paidFrom ? { baixaInicio: paidFrom } : {}), ...(paidTo ? { baixaFim: paidTo } : {}),
  };
}

function CommitmentFilterInputs(filters: CommitmentFilters) {
  return <>{Object.entries(commitmentFilterParams(filters)).map(([name, value]) =>
    <input key={name} type="hidden" name={name} value={value} />)}</>;
}

export function Commitments({ state, filter, createError, kind, deadline, view, paidFrom, paidTo, requestedPage }: {
  state: RetailState; filter: Filter; createError?: string; requestedPage?: string;
} & CommitmentFilters) {
  const now = today();
  const month = now.slice(0, 7);
  const soon = new Date(now + "T00:00:00Z");
  soon.setUTCDate(soon.getUTCDate() + 5);
  const limit = soon.toISOString().slice(0, 10);
  const entryId = randomUUID();
  const paid = view === "pagos";
  const unitEntries = state.ledger.filter((item) => !item.canceled && (!filter || item.store === filter));
  const monthlyOut = unitEntries.filter((item) => item.direction === "out" && (item.due || item.date).startsWith(month));
  const stats = [
    ["Total a pagar com vencimento neste mês", totalOf(monthlyOut, (item) => item.amount)],
    ["Em aberto neste mês", totalOf(monthlyOut, balanceDue)],
    ["Já baixado dos vencimentos deste mês", totalOf(monthlyOut, settledAmount)],
    ["Em atraso · todos os meses", totalOf(unitEntries.filter((item) => item.direction === "out" && item.due && item.due < now), balanceDue)],
  ] as const;
  const lastPayment = (entry: LedgerEntry) => entry.settlements.reduce((last, payment) =>
    !payment.reversedOn && payment.date > last ? payment.date : last, "");
  const entryKind = (entry: LedgerEntry) => isFixedCommitment(entry) ? "fixos"
    : entry.frequency === "monthly" || (entry.manual && !entry.frequency) ? "mensais" : "avulsos";
  const entries = unitEntries.filter((item) => {
    if (kind && entryKind(item) !== kind) return false;
    if (paid) {
      const date = lastPayment(item);
      return balanceDue(item) === 0 && Boolean(date) && (!paidFrom || date >= paidFrom) && (!paidTo || date <= paidTo);
    }
    return balanceDue(item) > 0
      && (deadline !== "mes" || (item.due || item.date).startsWith(month))
      && (deadline !== "atrasados" || Boolean(item.due && item.due < now))
      && (deadline !== "a-vencer" || Boolean(item.due && item.due >= now && item.due <= limit));
  }).sort((a, b) => paid ? lastPayment(b).localeCompare(lastPayment(a)) : (a.due || "9999").localeCompare(b.due || "9999"));
  const pageCount = Math.max(1, Math.ceil(entries.length / 15));
  const requested = Number(requestedPage);
  const page = Number.isSafeInteger(requested) ? Math.min(pageCount, Math.max(1, requested)) : 1;
  const pageStart = (page - 1) * 15;
  const recurring = state.ledger.filter((entry) => entry.recurrence && !entry.recurrence.endedOn && (!filter || entry.store === filter));
  const filters = { kind, deadline, view, paidFrom, paidTo };
  const href = (changes: CommitmentFilters = {}, nextPage?: number) => "/admin?" + new URLSearchParams({
    tab: "compromissos", ...(filter ? { loja: filter } : {}),
    ...commitmentFilterParams({ ...filters, ...changes }), ...(nextPage ? { compromissosPagina: String(nextPage) } : {}),
  });
  return <>
    <CreateDialog id="novo-compromisso" title="Novo compromisso" reopen={Boolean(createError)}>
      {createError && <p className="feedback error" role="alert">{createError}</p>}
      <form className="admin-form" action={saveLedgerEntry}>
        <HiddenFilter filter={filter} /><CommitmentFilterInputs {...filters} />
        <input type="hidden" name="entryId" value={entryId} /><input type="hidden" name="focus" value={entryId} />
        <label>Descrição<input name="name" maxLength={120} required placeholder="Ex.: aluguel, internet ou serviço prestado" /></label>
        <label>Unidade<select name="store" defaultValue={filter} required><option value="">Selecione</option>{storeList(state).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        <label>Tipo<SearchSelect name="direction"><option value="out">A pagar · despesa</option><option value="in">A receber · outra receita</option></SearchSelect></label>
        <label>Classificação<SearchSelect name="classification"><option value="operacional">Operacional · DRE e caixa</option><option value="somente-caixa">Somente caixa · ex.: aporte ou investimento</option></SearchSelect></label>
        <CommitmentFrequency />
        <Currency name="amount" label="Valor (R$)" required />
        <label>Data de competência<input type="date" name="date" defaultValue={now} required /></label>
        <label>Vencimento<input type="date" name="due" required /></label>
        <div className="span-two"><Submit>Lançar compromisso</Submit></div>
      </form>
    </CreateDialog>
    <div className="metrics-grid">{stats.map(([name, value]) => <Metric key={name} name={name} value={value} />)}</div>
    <nav className="branch-filter" aria-label="Situação dos compromissos">
      <Link href={href({ view: undefined })} aria-current={!paid ? "page" : undefined}>Em aberto</Link>
      <Link href={href({ view: "pagos" })} aria-current={paid ? "page" : undefined}>Pagos e recebidos</Link>
    </nav>
    <section className="panel">
      <div className="panel-title"><h2>{paid ? "Histórico de pagamentos e recebimentos" : "Compromissos em aberto"}</h2></div>
      <div className="panel-title">
        <nav className="stock-category-filter" aria-label="Tipo de compromisso">
          {[[undefined, "Todos os tipos"], ["fixos", "Fixos"], ["mensais", "Mensais"], ["avulsos", "Avulsos"]].map(([key, label]) =>
            <Link key={label} href={href({ kind: key })} aria-current={kind === key ? "page" : undefined}>{label}</Link>)}
        </nav>
        {!paid && <nav className="stock-category-filter" aria-label="Vencimento dos compromissos">
          {[[undefined, "Todos os prazos"], ["mes", "Este mês"], ["atrasados", "Atrasados"], ["a-vencer", "A vencer em até 5 dias"]].map(([key, label]) =>
            <Link key={label} href={href({ deadline: key })} aria-current={deadline === key ? "page" : undefined}>{label}</Link>)}
        </nav>}
      </div>
      {paid && <form action="/admin" method="get" className="admin-form report-filter" key={(paidFrom ?? "") + ":" + (paidTo ?? "")}>
        <input type="hidden" name="tab" value="compromissos" /><input type="hidden" name="loja" value={filter} />
        <CommitmentFilterInputs kind={kind} deadline={deadline} view={view} />
        <label>Última baixa a partir de<input type="date" name="baixaInicio" defaultValue={paidFrom} /></label>
        <label>Última baixa até<input type="date" name="baixaFim" defaultValue={paidTo} /></label>
        <button className="button yellow" type="submit">Aplicar período</button>
        {(paidFrom || paidTo) && <Link className="button" href={href({ paidFrom: undefined, paidTo: undefined })}>Limpar período</Link>}
      </form>}
      {entries.length ? <div className="table-wrap"><table>
        <thead><tr>{["Compromisso", "Unidade", paid ? "Última baixa" : "Vencimento", "Status", paid ? "Valor baixado" : "Saldo", "Ações"].map((name) => <th scope="col" key={name}>{name}</th>)}</tr></thead>
        <tbody>{entries.slice(pageStart, pageStart + 15).map((entry) => {
          const template = entry.recurringFrom ? state.ledger.find((item) => item.id === entry.recurringFrom) : entry;
          const rule = template?.recurrence;
          return <tr key={entry.id}>
            <td><strong>{entry.name}</strong><small>{labels[entry.kind]}{" · " + ({ fixos: "Fixo", mensais: "Mensal", avulsos: "Avulso" })[entryKind(entry)]}</small></td>
            <td>{storeName(entry.store, state)}</td><td>{shortDate(paid ? lastPayment(entry) : entry.due)}</td>
            <td><span className="pill">{paid ? (entry.direction === "out" ? "Pago" : "Recebido") : entry.due && entry.due < now ? "Atrasado" : entry.direction === "in" ? "A receber" : "A pagar"}</span></td>
            <td>{money(paid ? settledAmount(entry) : balanceDue(entry))}</td>
            <td><div className="workspace-section-links">
              <DetailsDialog id={"compromisso-" + entry.id} title={entry.name}>
                <div className="sale-detail-content">
                  <section className="sale-detail-card"><h3>Dados do compromisso</h3>
                    <p>{storeName(entry.store, state)} · {labels[entry.kind]} · {money(entry.amount)}</p>
                    {rule && <p>{rule.endedOn ? "Recorrência encerrada em " + shortDate(rule.endedOn) : rule.months ? "Recorrência de " + rule.months + " mês(es)" : "Recorrência mensal até encerrar"}</p>}
                    {!paid && <LedgerForm entry={entry} filter={filter} mode="schedule" filters={filters} />}
                    {rule && !rule.endedOn && <details><summary>Encerrar recorrência</summary>
                      <p>Os compromissos já gerados continuam disponíveis.</p>
                      <LedgerForm entry={entry} filter={filter} mode="end-recurrence" filters={filters} />
                    </details>}
                  </section>
                  {entry.settlements.map((payment) => <div className="sale-detail-card" key={payment.id}>
                    <p>Baixa de {money(payment.amount)} em {shortDate(payment.date)}{payment.reversedOn ? " · Estornada em " + shortDate(payment.reversedOn) : ""}</p>
                    {(entry.kind !== "ajuste" || entry.manual) && !payment.reversedOn &&
                      <details name={"settlements-" + entry.id}><summary>Registrar estorno da baixa</summary>
                        <LedgerForm entry={entry} filter={filter} mode="reverse" settlementId={payment.id} filters={filters} />
                      </details>}
                  </div>)}
                  {entry.manual && entry.settlements.every((payment) => payment.reversedOn) &&
                    <DetailsDialog id={"cancelar-" + entry.id} title="Cancelar este lançamento?" trigger="Cancelar este lançamento" danger>
                      <div className="sale-detail-content">
                        <p>{entry.name} · {money(entry.amount)}. Confirme o cancelamento deste lançamento.</p>
                        <LedgerForm entry={entry} filter={filter} mode="cancel" filters={filters} />
                      </div>
                    </DetailsDialog>}
                </div>
              </DetailsDialog>
              {!paid && entry.cardReconciliation && <small>Baixa em Caixa → Conciliação de cartão</small>}
              {!paid && !entry.cardReconciliation && <DetailsDialog id={"baixa-" + entry.id} title="Registrar baixa" trigger="Registrar baixa">
                <LedgerForm entry={entry} filter={filter} mode="pay" filters={filters} />
              </DetailsDialog>}
            </div></td>
          </tr>;
        })}</tbody>
      </table></div> : <p className="admin-empty">Nenhum compromisso nesta seleção.</p>}
      {pageCount > 1 && <nav className="panel-title" aria-label="Páginas dos compromissos">
        <span>Página {page} de {pageCount} · {pageStart + 1}–{Math.min(pageStart + 15, entries.length)} de {entries.length}</span>
        <div className="workspace-section-links">
          {page > 1 && <Link href={href({}, page - 1)}>Anterior</Link>}
          {page < pageCount && <Link href={href({}, page + 1)}>Próxima</Link>}
        </div>
      </nav>}
    </section>
    {recurring.length > 0 && <section className="panel">
      <div className="panel-title"><h2>Recorrências cadastradas</h2></div>
      <div className="table-wrap"><table>
        <thead><tr><th scope="col">Compromisso</th><th scope="col">Unidade</th><th scope="col">Duração</th><th scope="col">Ação</th></tr></thead>
        <tbody>{recurring.map((entry) => <tr key={entry.id}>
          <td>{entry.name}</td><td>{storeName(entry.store, state)}</td><td>{entry.recurrence?.months ? entry.recurrence.months + " mês(es)" : "Até encerrar"}</td>
          <td><DetailsDialog id={"recorrencia-" + entry.id} title="Encerrar recorrência" trigger="Encerrar recorrência">
            <div className="sale-detail-content">
              <p>{entry.name} · {storeName(entry.store, state)}</p>
              <p>Os compromissos já gerados continuam disponíveis.</p>
              <LedgerForm entry={entry} filter={filter} mode="end-recurrence" filters={filters} />
            </div>
          </DetailsDialog></td>
        </tr>)}</tbody>
      </table></div>
    </section>}
  </>;
}

function LedgerForm({ entry, filter, mode, settlementId, filters }: { entry: LedgerEntry; filter: Filter; mode: string; settlementId?: string; filters: CommitmentFilters }) {
  return <form className="admin-form" action={updateLedger}>
    <HiddenFilter filter={filter} /><CommitmentFilterInputs {...filters} />
    <input type="hidden" name="id" value={entry.id} /><input type="hidden" name="mode" value={mode} />
    {mode === "cancel" && <label className="checkbox span-two"><input type="checkbox" name="confirmed" required /> Confirmo o cancelamento</label>}
    {mode === "pay" && <><input type="hidden" name="paymentId" value={randomUUID()} /><Currency name="amount" label="Valor desta baixa (R$)" value={balanceDue(entry)} required /></>}
    {settlementId && <input type="hidden" name="settlementId" value={settlementId} />}
    {mode !== "cancel" && mode !== "end-recurrence" && <label>{mode === "schedule" ? "Novo vencimento" : mode === "reverse" ? "Data do estorno" : "Data da baixa"}
      <input name="date" type="date" defaultValue={mode === "schedule" ? entry.due : today()} required /></label>}
    <div><Submit variant={mode === "cancel" ? "danger" : "yellow"}>{mode === "schedule" ? "Atualizar vencimento" : mode === "reverse" ? "Confirmar estorno" : mode === "cancel" ? "Confirmar cancelamento" : mode === "end-recurrence" ? "Confirmar encerramento" : "Registrar baixa"}</Submit></div>
  </form>;
}
