"use client";

import { useState } from "react";
import { cardQuote, money, type Store, type CardRate, type Product, type StoreId } from "@/domain/retail";

type StockProduct = Pick<Product, "id" | "name" | "sku" | "price" | "stock">;

export function Simulator({ products, rates, initialStore, stores }: { products: StockProduct[]; rates: CardRate[]; initialStore: StoreId; stores: readonly Store[] }) {
  const [store, setStore] = useState(initialStore);
  const [productId, setProductId] = useState("");
  const [rateId, setRateId] = useState("");
  const [quantityText, setQuantity] = useState("1");
  const [discountText, setDiscount] = useState("");
  const available = products.filter((item) => item.stock[store] > 0 && item.price > 0);
  const product = available.find((item) => item.id === productId) ?? available[0];
  const rate = rates.find((item) => item.id === rateId) ?? rates[0];
  const quantity = Number(quantityText);
  const discount = Math.round(Number(discountText.replace(",", ".")) * 100);
  const subtotal = (product?.price ?? 0) * quantity;
  const gross = subtotal - discount;
  const valid = product && Number.isInteger(quantity) && quantity > 0 && quantity <= product.stock[store]
    && Number.isSafeInteger(subtotal) && Number.isSafeInteger(discount) && discount >= 0 && gross > 0;
  const quote = valid && rate ? cardQuote(gross, rate) : null;

  return <div className="operation-grid">
    <section className="panel">
      <div className="panel-title"><h2>Monte a proposta</h2><span className="pill">SIMULAÇÃO</span></div>
      <div className="admin-form">
        <label>Unidade<select value={store} onChange={(event) => { setStore(event.target.value as StoreId); setProductId(""); setQuantity("1"); }}>
          {stores.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>
        <label>Produto em estoque<select value={product?.id ?? ""} onChange={(event) => { setProductId(event.target.value); setQuantity("1"); }}>
          {!available.length && <option value="">Sem produtos disponíveis</option>}
          {available.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stock[store]} un.</option>)}
        </select></label>
        <label>Quantidade<input type="number" min="1" max={product?.stock[store]} value={quantityText} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label>Desconto (R$)<input inputMode="decimal" value={discountText} placeholder="0,00" onChange={(event) => setDiscount(event.target.value)} /></label>
        <label className="span-two">Condição de cartão<select value={rate?.id ?? ""} onChange={(event) => setRateId(event.target.value)}>
          {!rates.length && <option value="">Nenhuma taxa cadastrada</option>}
          {rates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.mode} {item.installments}× · {(item.basisPoints / 100).toLocaleString("pt-BR")}%</option>)}
        </select></label>
      </div>
    </section>
    <section className="panel quote-result" aria-live="polite">
      <div className="panel-title"><h2>Resumo para atendimento</h2></div>
      {quote && rate ? <div className="quote-body">
        <span>Total para o cliente</span><strong>{money(gross)}</strong>
        <p>{rate.installments === 1 ? "Pagamento em 1×" : quote.remainder === 0
          ? `${rate.installments}× de ${money(quote.installment)}`
          : `${rate.installments - quote.remainder}× de ${money(quote.installment)} + ${quote.remainder}× de ${money(quote.installment + 1)}`}</p>
        <dl><div><dt>Taxa estimada</dt><dd>{money(quote.fee)}</dd></div><div><dt>Líquido estimado da loja</dt><dd>{money(quote.net)}</dd></div></dl>
        <small>Simulação sem baixa no estoque. Considera a taxa informada, sem custos adicionais de antecipação.</small>
      </div> : <p className="admin-empty">{!product ? "Cadastre um preço e adicione saldo na unidade para simular." : !valid ? "Confira a quantidade disponível e o desconto." : "Cadastre uma taxa de cartão para calcular a proposta."}</p>}
    </section>
  </div>;
}
