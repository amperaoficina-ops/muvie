"use client";

import "./simulator.css";
import { useState } from "react";
import { money, paymentMethods, percentageAmount, type Store, type CardRate, type TaxRate } from "@/domain/retail";
import { completePaymentAmounts, parseReais } from "@/domain/money-input";
import { proposalQuote, type ProposalProduct } from "@/domain/proposal";

export function Simulator({ products, rates, initialStore, stores, taxRates, showFinance }: {
  products: ProposalProduct[]; rates: CardRate[]; initialStore: string; stores: readonly Store[];
  taxRates: TaxRate[]; showFinance: boolean;
}) {
  const [store, setStore] = useState(initialStore);
  const [items, setItems] = useState([{ productId: "", quantity: "1" }]);
  const [payments, setPayments] = useState([{ method: "Pix", amount: "", rateId: rates[0]?.id ?? "" }]);
  const [discount, setDiscount] = useState("");
  const [customer, setCustomer] = useState("");
  const [taxMode, setTaxMode] = useState("");
  const [manualTax, setManualTax] = useState("");
  const available = products.filter((item) => item.stock[store] > 0 && item.price > 0);
  const base = proposalQuote(products, rates, store, items, [{ method: "Pix", amount: "", rateId: "" }], discount);
  const amounts = completePaymentAmounts(base?.total ?? 0, payments.map((payment) => payment.amount));
  const entered = amounts.reduce((sum, value) => sum + (parseReais(value) ?? 0), 0);
  const difference = base ? base.total - entered : 0;
  const quote = proposalQuote(products, rates, store, items, payments.map((payment, index) => ({ ...payment, amount: amounts[index] })), discount);
  const rate = taxRates.find((item) => item.id === taxMode) ?? taxRates.find((item) => item.defaultForSale);
  const tax = taxMode === "manual" ? parseReais(manualTax) : percentageAmount(quote?.total ?? 0, rate?.basisPoints ?? 0);

  return <div className="operation-grid simulator-layout">
    <section className="panel">
      <div className="panel-title"><h2>Monte a proposta</h2></div>
      <div className="admin-form simulator-form">
        <label>Unidade<select value={store} onChange={(event) => { setStore(event.target.value); setItems([{ productId: "", quantity: "1" }]); }}>
          {stores.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>
        <label>Nome do cliente (opcional)<input value={customer} maxLength={100} onChange={(event) => setCustomer(event.target.value)} /></label>
        <fieldset className="address-fields span-two checkout-group"><legend>Produtos</legend>
          {items.map((item, index) => <div className="checkout-row span-two" key={index}>
            <label>Produto <select value={item.productId} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, productId: event.target.value } : row))}>
              <option value="">{available.length ? "Selecione um produto" : "Sem produtos disponíveis"}</option>
              {available.map((row) => <option value={row.id} key={row.id}>{row.name} · {money(row.price)} · {row.stock[store]} un.</option>)}
            </select></label>
            <label>Quantidade<input type="number" min="1" value={item.quantity} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} /></label>
            {items.length > 1 && <button type="button" className="button danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remover produto</button>}
          </div>)}
          <button type="button" className="button" disabled={items.length >= 20} onClick={() => setItems([...items, { productId: "", quantity: "1" }])}>Adicionar produto</button>
        </fieldset>
        <label className="span-two">Desconto (R$)<input value={discount} inputMode="decimal" placeholder="0,00" onChange={(event) => setDiscount(event.target.value)} /></label>
        <fieldset className="address-fields span-two checkout-group"><legend>Pagamento</legend>
          {payments.map((payment, index) => <div className="checkout-row span-two" key={index}>
            <label>Forma de pagamento<select value={payment.method} onChange={(event) => setPayments(payments.map((row, i) => i === index ? { ...row, method: event.target.value } : row))}>
              {paymentMethods.map((method) => <option key={method}>{method}</option>)}
            </select></label>
            {payments.length > 1 && <label>{index === payments.length - 1 ? "Saldo automático (R$)" : "Valor (R$)"}<input value={amounts[index]} readOnly={index === payments.length - 1} inputMode="decimal" onChange={(event) => setPayments(payments.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} /></label>}
            {payment.method === "Cartão" && <label>Condição de cartão<select value={payment.rateId} onChange={(event) => setPayments(payments.map((row, i) => i === index ? { ...row, rateId: event.target.value } : row))}>
              {!rates.length && <option value="">Nenhuma taxa cadastrada</option>}
              {rates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.mode} · {item.installments}×</option>)}
            </select></label>}
            {payments.length > 1 && <button type="button" className="button danger" onClick={() => setPayments(payments.filter((_, i) => i !== index))}>Remover pagamento</button>}
          </div>)}
          {base && payments.length > 1 && <p className="form-note span-two">
            {difference === 0 ? (parseReais(amounts[amounts.length - 1]) ? "O último pagamento completa o total automaticamente." : "Os pagamentos anteriores já cobrem o total. Remova o último ou reduza os valores anteriores.") : difference > 0
              ? "Falta distribuir " + money(difference) : "Os pagamentos excedem o total em " + money(-difference)}
          </p>}
          <button type="button" className="button" disabled={payments.length >= 10} onClick={() => setPayments([...payments, { method: "Pix", amount: "", rateId: rates[0]?.id ?? "" }])}>Combinar pagamento</button>
        </fieldset>
        {showFinance && <>
          <label>Imposto<select value={taxMode} onChange={(event) => setTaxMode(event.target.value)}>
            <option value="">Padrão da venda</option>
            {taxRates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.basisPoints / 100}%</option>)}
            <option value="manual">Valor manual</option>
          </select></label>
          {taxMode === "manual" && <label>Imposto (R$)<input inputMode="decimal" value={manualTax} onChange={(event) => setManualTax(event.target.value)} /></label>}
        </>}
      </div>
    </section>
    <section className="panel quote-result simulator-summary">
      <div className="panel-title"><h2>Resumo para atendimento</h2></div>
      {quote ? <div className="quote-body">
        <div className="simulator-total"><span>Total para o cliente</span><strong>{money(quote.total)}</strong></div>
        {quote.discount > 0 && <p>Desconto de {money(quote.discount)} incluído</p>}
        <h3>Condições de pagamento</h3>
        <dl>{quote.payments.map((payment, index) => <div key={index}>
          <dt>{payment.method}{payment.installments && <small>{payment.installments}</small>}</dt><dd>{money(payment.amount)}</dd>
        </div>)}</dl>
        <form action="/admin/simulador/proposta" method="post">
          <input type="hidden" name="store" value={store} /><input type="hidden" name="customer" value={customer} />
          <input type="hidden" name="discount" value={discount} />
          {items.map((item, index) => <div key={index}><input type="hidden" name="product" value={item.productId} /><input type="hidden" name="quantity" value={item.quantity} /></div>)}
          {payments.map((payment, index) => <div key={index}><input type="hidden" name="method" value={payment.method} /><input type="hidden" name="amount" value={amounts[index]} /><input type="hidden" name="rate" value={payment.rateId} /></div>)}
          <button type="submit" className="button yellow">Baixar PDF da proposta</button>
        </form>
        {showFinance && <details className="simulator-finance"><summary>Detalhes financeiros</summary><dl>
          <div><dt>Taxa de cartão</dt><dd>{money(quote.fees)}</dd></div>
          <div><dt>Imposto estimado</dt><dd>{tax == null || tax > quote.total ? "Confira o valor" : money(tax)}</dd></div>
          {tax != null && tax <= quote.total && <div><dt>Líquido após taxas e imposto</dt><dd>{money(quote.total - quote.fees - tax)}</dd></div>}
        </dl></details>}
        <small>Simulação sem reserva de estoque.</small>
      </div> : <p className="admin-empty">Selecione os produtos e confira as quantidades, o desconto e os pagamentos. Ao combinar formas, a soma deve bater com o total da proposta.</p>}
    </section>
  </div>;
}
