import Link from "next/link";
import { money, stockComposition, storeList, type RetailState } from "@/domain/retail";
import type { InvoiceMeta } from "@/lib/invoices";

export function InventoryOverview({ state, filter, showCost }: { state: RetailState; filter: string; showCost: boolean }) {
  const purchases = state.purchases.filter((item) => !filter || item.store === filter);
  const units = storeList(state).filter((unit) => !filter || unit.id === filter);
  const rows = units.map((unit) => {
    const mix = stockComposition(state, unit.id);
    const lots = state.stockLots.filter((lot) => lot.store === unit.id && lot.quantity > 0);
    return { ...unit, ...mix,
      stockCost: lots.reduce((sum, lot) => sum + lot.unitCost * lot.quantity, 0),
      untracked: mix.total - lots.reduce((sum, lot) => sum + lot.quantity, 0),
      retail: state.products.reduce((sum, product) => sum + product.price * (product.stock[unit.id] ?? 0), 0),
    };
  });
  const total = (key: "stockCost" | "untracked" | "retail") => rows.reduce((sum, row) => sum + row[key], 0);
  const max = Math.max(1, ...rows.map((row) => row.total));
  const values = [
    ...(showCost ? [
      ["Estoque a custo registrado", money(total("stockCost")), total("untracked") + " un. sem custo de lote"],
      ["Compras próprias registradas", money(purchases.filter((item) => item.acquisition !== "consignada").reduce((sum, item) => sum + item.total, 0)), "Histórico completo da seleção"],
    ] : []),
    ["Venda estimada do estoque", money(total("retail")), "Saldo × preço atual do catálogo interno"],
  ];
  return <section className="panel">
    <div className="panel-title"><h2>Posição de estoque</h2><span className="pill">Saldo atual</span></div>
    <div className="dashboard-values">{values.map(([title, value, note]) => <div key={title}><p>{title}</p><strong>{value}</strong><small>{note}</small></div>)}</div>
    <div className="dashboard-bars">
      {rows.map((row) => <div key={row.id}>
        <div><strong>{row.name}</strong><span>{row.owned} próprias ou sem lote · {row.consigned} consignadas</span></div>
        <div className="inventory-bar" aria-hidden="true">
          <span style={{ width: row.owned / max * 100 + "%" }} /><span style={{ width: row.consigned / max * 100 + "%" }} />
        </div>
      </div>)}
    </div>
  </section>;
}

export function InvoiceOverview({ state, invoices, filter, sales, purchases }: {
  state: RetailState; invoices: InvoiceMeta[]; filter: string; sales: boolean; purchases: boolean;
}) {
  const attached = new Set(invoices.map((invoice) => invoice.owner + ":" + invoice.ownerId));
  const docs = [
    ...(sales ? state.sales.filter((sale) => !sale.canceledAt && (!filter || sale.store === filter))
      .map((sale) => ({ id: sale.id, name: sale.productName, tab: "vendas", status: attached.has("sale:" + sale.id) ? "Anexada" : sale.fiscalNotes !== undefined ? "Ficha preparada" : "Pendente" })) : []),
    ...(purchases ? state.purchases.filter((purchase) => !filter || purchase.store === filter)
      .map((purchase) => ({ id: purchase.id, name: purchase.productName, tab: "compras", status: attached.has("purchase:" + purchase.id) ? "Anexada" : "Pendente" })) : []),
  ];
  const open = docs.filter((doc) => doc.status !== "Anexada");
  return <section className="panel">
    <div className="panel-title"><h2>Acompanhamento fiscal</h2><span className="pill">Controle interno</span></div>
    <div className="dashboard-values">{["Pendente", "Ficha preparada", "Anexada"].map((status) => <div key={status}>
      <p>{status}</p><strong>{docs.filter((doc) => doc.status === status).length}</strong>
    </div>)}</div>
    <p className="admin-empty">Status por compra ou venda. A autorização fiscal é consultada no emissor.</p>
    {open.length > 0 && <details className="sale-pending-list"><summary>Ver documentos em aberto ({open.length})</summary>
      <ul>{open.map((doc) => <li key={doc.tab + doc.id}><Link className="back-link" href={"/admin?" + new URLSearchParams({
        tab: doc.tab, ficha: doc.id, ...(filter ? { loja: filter } : {}),
      })}>{doc.name}</Link><small>{doc.tab === "vendas" ? "Venda" : "Compra"} · {doc.status}</small></li>)}</ul>
    </details>}
  </section>;
}
