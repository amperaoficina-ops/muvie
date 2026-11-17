import type { TaxRate } from "@/domain/retail";
import { saveTaxRate } from "./actions";
import { Submit } from "./submit";

function TaxForm({ rate }: { rate?: TaxRate }) {
  return <form className="admin-form" action={saveTaxRate}>
    {rate && <input type="hidden" name="id" value={rate.id} />}
    <label>Nome<input name="name" required maxLength={70} placeholder="Ex.: Imposto sobre venda" defaultValue={rate?.name} /></label>
    <label>Alíquota (%)<input name="percent" required inputMode="decimal" maxLength={8} placeholder="0,00"
      defaultValue={rate ? (rate.basisPoints / 100).toFixed(2).replace(".", ",") : ""} /></label>
    <label className="checkbox span-two"><input name="defaultForSale" type="checkbox" defaultChecked={rate?.defaultForSale} /> Usar como padrão nas novas vendas</label>
    <div className="span-two"><Submit>{rate ? "Salvar alterações" : "Adicionar imposto"}</Submit></div>
  </form>;
}

export function TaxSettings({ rates }: { rates: TaxRate[] }) {
  return <div className="operation-grid">
    <section className="panel"><div className="panel-title"><h2>Impostos cadastrados</h2></div>
      <p className="admin-empty">A alíquota incide sobre o total após descontos. Cada venda guarda o imposto calculado no momento do registro.</p>
      {rates.length > 0 && <div className="editable-list">{rates.map((rate) => <details name="tax-rate" key={rate.id}>
        <summary><span><strong>{rate.name}</strong><small>{(rate.basisPoints / 100).toLocaleString("pt-BR")}%</small></span>
          {rate.defaultForSale && <span className="pill">Padrão de venda</span>}</summary>
        <TaxForm rate={rate} />
      </details>)}</div>}
    </section>
    <section className="panel"><div className="panel-title"><h2>Novo imposto</h2></div><TaxForm /></section>
  </div>;
}
