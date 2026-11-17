import type { overviewAccess } from "@/domain/access";
import { financialReport, money, overviewAnalytics, stages, type RetailState } from "@/domain/retail";
import "./overview-analytics.css";

type Rows = readonly (readonly [string, number])[];
const units = (value: number) => value.toLocaleString("pt-BR");
const dateLabel = (date: string) => date.slice(5).split("-").reverse().join("/");

function Bars({ title, rows, format = units, keepZeros = false }: {
  title: string; rows: Rows; format?: (value: number) => string; keepZeros?: boolean;
}) {
  const visible = keepZeros ? rows : rows.filter(([, value]) => value !== 0);
  const max = Math.max(1, ...visible.map(([, value]) => Math.abs(value)));
  return <section className="panel analytics-chart">
    <div className="panel-title"><h3>{title}</h3></div>
    {visible.length ? <dl>{visible.map(([name, value]) => <div key={name}>
      <dt>{name}</dt>
      <dd><span className="analytics-track" aria-hidden="true"><i data-negative={value < 0}
        style={{ width: Math.abs(value) / max * 100 + "%" }} /></span><strong>{format(value)}</strong></dd>
    </div>)}</dl> : <p className="admin-empty">Sem dados nesta seleção.</p>}
  </section>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="analytics-group"><h2>{title}</h2><div className="overview-grid">{children}</div></section>;
}

export function OverviewAnalytics({ state, store, from, to, access }: {
  state: RetailState; store?: string; from: string; to: string;
  access: ReturnType<typeof overviewAccess>;
}) {
  const data = overviewAnalytics(state, from, to, store);
  const finance = access.finance ? financialReport(state, from, to, store) : null;
  const bucketLabel = ({ start, end }: { start: string; end: string }) =>
    dateLabel(start) + (start === end ? "" : " a " + dateLabel(end)) + " · " + start.slice(0, 4);
  return <>
    {access.sales && <Group title="Desempenho comercial">
      <Bars title="Vendas por período" rows={data.buckets.map((bucket) => [bucketLabel(bucket), bucket.sales])} keepZeros />
      <Bars title="Faturamento líquido de descontos" rows={data.buckets.map((bucket) => [bucketLabel(bucket), bucket.revenue])} format={money} keepZeros />
      <Bars title="Vendas por unidade" rows={data.salesByStore} format={money} keepZeros />
      <Bars title="Valores por forma de pagamento" rows={data.salesByMethod} format={money} />
      <Bars title="Valor médio por venda" rows={[["Ticket médio", data.average]]} format={money} />
    </Group>}
    {finance && <Group title="Financeiro do período">
      <Bars title="Entradas e saídas de caixa" rows={[["Entradas", finance.incoming], ["Saídas", finance.outgoing], ["Caixa líquido", finance.cash]]} format={money} keepZeros />
      <Bars title="Custos e deduções do DRE" rows={[
        ["Custo dos produtos vendidos", finance.cost], ["Taxas de cartão", finance.cardFees], ["Impostos", finance.taxes],
        ["Comissões", finance.commissions], ["Salários", finance.salary], ["Fixos", finance.fixed], ["Outras despesas", finance.expenses],
      ]} format={money} />
      <Bars title="Resultado e distribuição" rows={[
        ["Resultado gerencial" + (finance.missingSales ? " · parcial" : ""), finance.result],
        ["Distribuição de lucro", finance.distributions], ["Após distribuição", finance.result - finance.distributions],
      ]} format={money} keepZeros />
    </Group>}
    {(access.inventory || access.purchases) && <Group title="Estoque e compras">
      {access.inventory && <>
        <Bars title="Estoque atual por categoria" rows={data.stockByCategory} />
        <Bars title="Estoque atual por cor registrada" rows={data.stockByColor} />
        <Bars title="Movimentações de unidades" rows={Object.entries(data.movementTotals)} />
      </>}
      {access.purchases && <Bars title="Compras por condição" rows={Object.entries(data.purchasesByStatus)} format={money} />}
    </Group>}
    {(access.crm || access.staff || access.assets) && <Group title="Clientes, equipe e patrimônio">
      {access.crm && <Bars title="Clientes por etapa" rows={stages.map((stage) => [stage, data.contacts.filter((contact) => contact.stage === stage).length])} keepZeros />}
      {access.staff && <>
        <Bars title="Equipe e vales" rows={[["Funcionários ativos", data.activeStaff], ["Vales emitidos no período", data.advances.length]]} keepZeros />
        <Bars title="Valor dos vales no período" rows={[["Vales emitidos", data.advances.reduce((sum, item) => sum + item.amount, 0)]]} format={money} />
      </>}
      {access.assets && <Bars title="Patrimônio cadastrado da unidade" rows={[
        ["Estrutura", data.assets.reduce((sum, item) => sum + item.amount, 0)],
        ["Bens de troca disponíveis", data.tradeIns.filter((item) => item.received && !item.resale).reduce((sum, item) => sum + item.amount, 0)],
      ]} format={money} keepZeros />}
    </Group>}
  </>;
}
