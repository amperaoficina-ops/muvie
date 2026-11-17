"use client";

import { productColors } from "@/domain/product-colors";
import { CardPaymentFields } from "./card-payment-fields";
import { SearchSelect } from "./search-select";
import "./simulator.css";
import { useState } from "react";
import { money, paymentMethods, percentageAmount, type Store, type CardMachine, type CardRate, type TaxRate, type StockLot, type Staff } from "@/domain/retail";
import { completePaymentAmounts, parseReais } from "@/domain/money-input";
import { proposalQuote, type ProposalProduct } from "@/domain/proposal";

export function Simulator({ products, rates, machines, initialStore, stores, taxRates, showFinance, lots, sellers }: {
  products: ProposalProduct[]; rates: CardRate[]; machines: CardMachine[]; initialStore: string; stores: readonly Store[];
  taxRates: TaxRate[]; showFinance: boolean;
  lots: Pick<StockLot, "productId" | "store" | "date" | "quantity" | "unitCost" | "color">[];
  sellers: Pick<Staff, "id" | "name" | "store" | "commissionBps">[];
}) {
  const [store, setStore] = useState(initialStore);
  const [items, setItems] = useState([{ productId: "", quantity: "1", color: "" }]);
  const [payments, setPayments] = useState([{ method: "Pix", amount: "", rateId: "", machineId: "" }]);
  const [discount, setDiscount] = useState("");
  const [customer, setCustomer] = useState("");
  const [sellerId, setSellerId] = useState("");
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

  const seller = sellers.find((item) => item.id === sellerId && item.store === store);
  const commission = percentageAmount(quote?.total ?? 0, seller?.commissionBps ?? 0);
  const availableLots = lots.filter((item) => item.store === store).sort((a, b) => a.date.localeCompare(b.date));
  const quantities = availableLots.map((lot) => lot.quantity);
  let productCost = 0;
  let missingCost = false;
  if (quote && showFinance) {
    for (const item of [...items].sort((a, b) => Number(Boolean(b.color)) - Number(Boolean(a.color)))) {
      let remaining = Number(item.quantity);
      for (const [index, lot] of availableLots.entries()) {
        if (!remaining) break;
        if (lot.productId !== item.productId || (item.color && lot.color !== item.color)) continue;
        const quantity = Math.min(remaining, quantities[index]);
        quantities[index] -= quantity;
        remaining -= quantity;
        productCost += quantity * lot.unitCost;
      }
      missingCost ||= remaining > 0;
    }
  }

  return <div className="operation-grid simulator-layout">
    <section className="panel">
      <div className="panel-title"><h2>Monte a proposta</h2></div>
      <div className="admin-form simulator-form">
        <label>Unidade<select value={store} onChange={(event) => { setStore(event.target.value); setSellerId(""); setItems([{ productId: "", quantity: "1", color: "" }]); }}>
          {stores.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>
        <label>Nome do cliente (opcional)<input value={customer} maxLength={100} onChange={(event) => setCustomer(event.target.value)} /></label>
        <fieldset className="address-fields span-two checkout-group"><legend>Produtos</legend>
          {items.map((item, index) => <div className="checkout-row span-two" key={index}>
            <label>Produto <SearchSelect value={item.productId} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, productId: event.target.value, color: "" } : row))}>
              <option value="">{available.length ? "Selecione um produto" : "Sem produtos disponíveis"}</option>
              {available.map((row) => <option value={row.id} key={row.id}>{row.name} · {money(row.price)} · {row.stock[store]} un.</option>)}
            </SearchSelect></label>
            {item.productId && <label>Cor<SearchSelect value={item.color} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, color: event.target.value } : row))}>
              <option value="">Sem preferência</option>
              {productColors.filter((color) => (available.find((row) => row.id === item.productId)?.colorStock?.[store]?.[color] ?? 0) > 0)
                .map((color) => <option key={color}>{color}</option>)}
            </SearchSelect></label>}
            <label>Quantidade<input type="number" min="1" value={item.quantity} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} /></label>
            {items.length > 1 && <button type="button" className="button danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remover produto</button>}
          </div>)}
          <button type="button" className="button" disabled={items.length >= 20} onClick={() => setItems([...items, { productId: "", quantity: "1", color: "" }])}>Adicionar produto</button>
        </fieldset>
        <label className="span-two">Desconto (R$)<input value={discount} inputMode="decimal" placeholder="0,00" onChange={(event) => setDiscount(event.target.value)} /></label>
        <fieldset className="address-fields span-two checkout-group"><legend>Pagamento</legend>
          {payments.map((payment, index) => <div className="checkout-row span-two" key={index}>
            <label>Forma de pagamento<SearchSelect value={payment.method} onChange={(event) => setPayments(payments.map((row, i) => i === index ? { ...row, method: event.target.value } : row))}>
              {paymentMethods.map((method) => <option key={method}>{method}</option>)}
            </SearchSelect></label>
            {payments.length > 1 && <label>{index === payments.length - 1 ? "Saldo automático (R$)" : "Valor (R$)"}<input value={amounts[index]} readOnly={index === payments.length - 1} inputMode="decimal" onChange={(event) => setPayments(payments.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} /></label>}
            {payment.method === "Cartão" && <CardPaymentFields machines={machines} rates={rates} machineId={payment.machineId} rateId={payment.rateId}
              onChange={(machineId, rateId) => setPayments(payments.map((row, i) => i === index ? { ...row, machineId, rateId } : row))} />}
            {payments.length > 1 && <button type="button" className="button danger" onClick={() => setPayments(payments.filter((_, i) => i !== index))}>Remover pagamento</button>}
          </div>)}
          {base && payments.length > 1 && <p className="form-note span-two">
            {difference === 0 ? (parseReais(amounts[amounts.length - 1]) ? "O último pagamento completa o total automaticamente." : "Os pagamentos anteriores já cobrem o total. Remova o último ou reduza os valores anteriores.") : difference > 0
              ? "Falta distribuir " + money(difference) : "Os pagamentos excedem o total em " + money(-difference)}
          </p>}
          <button type="button" className="button" disabled={payments.length >= 10} onClick={() => setPayments([...payments, { method: "Pix", amount: "", rateId: "", machineId: "" }])}>Combinar pagamento</button>
        </fieldset>
        {showFinance && <>
          <label>Vendedor (opcional)<SearchSelect value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
            <option value="">Sem vendedor</option>
            {sellers.filter((seller) => seller.store === store).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </SearchSelect></label>
          <label>Imposto<SearchSelect value={taxMode} onChange={(event) => setTaxMode(event.target.value)}>
            <option value="">Padrão da venda</option>
            {taxRates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.basisPoints / 100}%</option>)}
            <option value="manual">Valor manual</option>
          </SearchSelect></label>
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
          {items.map((item, index) => <div key={index}><input type="hidden" name="product" value={item.productId} /><input type="hidden" name="quantity" value={item.quantity} /><input type="hidden" name="color" value={item.color} /></div>)}
          {payments.map((payment, index) => <div key={index}><input type="hidden" name="method" value={payment.method} /><input type="hidden" name="amount" value={amounts[index]} /><input type="hidden" name="rate" value={payment.rateId} /><input type="hidden" name="machine" value={payment.machineId} /></div>)}
          <button type="submit" className="button yellow">Baixar PDF da proposta</button>
        </form>
        {showFinance && <section className="simulator-finance">
          <h3>Detalhes financeiros</h3>
          <dl>
            <div><dt>Custo dos produtos</dt><dd>{missingCost ? "Custo incompleto" : money(productCost)}</dd></div>
            <div><dt>Taxa de cartão</dt><dd>{money(quote.fees)}</dd></div>
            <div><dt>Imposto estimado</dt><dd>{tax == null || tax > quote.total ? "Confira o valor" : money(tax)}</dd></div>
            <div><dt>Comissão estimada</dt><dd>{money(commission)}</dd></div>
            <div><dt><strong>Lucro estimado</strong></dt><dd>{missingCost || tax == null || tax > quote.total
              ? "Pendente" : money(quote.total - productCost - quote.fees - tax - commission)}</dd></div>
          </dl>
          <small>{missingCost ? "Há unidades sem custo de lote cadastrado." : "Custo estimado pelos lotes mais antigos da unidade."}</small>
        </section>}
        <small>Simulação sem reserva de estoque.</small>
      </div> : <p className="admin-empty">Selecione os produtos e confira as quantidades, o desconto e os pagamentos. Ao combinar formas, a soma deve bater com o total da proposta.</p>}
    </section>
  </div>;
}
