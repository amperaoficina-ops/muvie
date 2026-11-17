"use client";

import { useState } from "react";
import { money, paymentMethods, cardQuote, percentageAmount, type TaxRate, type CardRate, type Product, type StockLot, type Store } from "@/domain/retail";
import { parseReais } from "@/domain/money-input";

type Item = { key: number; productId: string; quantity: number; gift: boolean; origin: string; override?: string };
type Payment = { key: number; method: typeof paymentMethods[number]; value: string; rateId: string; received: boolean; due: string };
type SaleProduct = Pick<Product, "id" | "name" | "sku" | "price" | "stock">;

export function CheckoutFields({ units, initialStore, products, lots, rates, sellers, showCost, taxRates }: {
  units: readonly Store[]; initialStore: string; products: SaleProduct[]; lots: StockLot[]; rates: CardRate[]; taxRates: TaxRate[]; sellers: { id: string; name: string; store: string; commissionBps: number }[]; showCost: boolean;
}) {
  const [store, setStore] = useState(initialStore);
  const [items, setItems] = useState<Item[]>([{ key: 0, productId: "", quantity: 1, gift: false, origin: "" }]);
  const [payments, setPayments] = useState<Payment[]>([{ key: 0, method: "Pix", value: "", rateId: "", received: true, due: "" }]);
  const [sellerId, setSeller] = useState("");
  const defaultTax = taxRates.find((rate) => rate.defaultForSale);
  const [taxMode, setTaxMode] = useState(defaultTax?.id ?? "");
  const [manualTax, setManualTax] = useState("");
  const [discount, setDiscount] = useState("");
  const available = products.filter((product) => (product.stock[store] ?? 0) > 0);
  const availableLots = lots.filter((lot) => lot.store === store && lot.quantity > 0).sort((a, b) => a.date.localeCompare(b.date));
  const gross = items.reduce((sum, item) => sum + (item.gift ? 0 : (products.find((product) => product.id === item.productId)?.price ?? 0) * item.quantity), 0);
  const total = Math.max(gross - (parseReais(discount) ?? 0), 0);
  const selectedTax = taxRates.find((rate) => rate.id === taxMode);
  const tax = taxMode === "manual" ? parseReais(manualTax) ?? 0 : percentageAmount(total, selectedTax?.basisPoints ?? defaultTax?.basisPoints ?? 0);
  const usedLots = new Map<string, number>();
  let cost = 0;
  let missingCost = false;
  for (const item of items) {
    const product = available.find((entry) => entry.id === item.productId);
    if (!product) continue;
    let remaining = item.quantity;
    let lotCost = 0;
    for (const lot of availableLots.filter((lot) => lot.productId === item.productId && item.origin === lot.purchaseId)) {
      const quantity = Math.min(remaining, Math.max(0, lot.quantity - (usedLots.get(lot.purchaseId) ?? 0)));
      lotCost += quantity * lot.unitCost;
      remaining -= quantity;
      usedLots.set(lot.purchaseId, (usedLots.get(lot.purchaseId) ?? 0) + quantity);
    }
    const override = item.override?.trim() ? parseReais(item.override) : lotCost;
    if (remaining || override === null) missingCost = true;
    else cost += item.override?.trim() ? override * item.quantity : override;
  }
  const fees = payments.reduce((sum, payment) => {
    const rate = payment.method === "Cartão" ? rates.find((item) => item.id === payment.rateId) : undefined;
    return sum + (rate ? cardQuote(payments.length === 1 ? total : parseReais(payment.value) ?? 0, rate).fee : 0);
  }, 0);
  const receivedGross = payments.reduce((sum, payment) => sum + (payment.received ? (payments.length === 1 ? total : parseReais(payment.value) ?? 0) : 0), 0);
  const receivedFees = payments.reduce((sum, payment) => {
    const rate = payment.received && payment.method === "Cartão" ? rates.find((item) => item.id === payment.rateId) : undefined;
    return sum + (rate ? cardQuote(payments.length === 1 ? total : parseReais(payment.value) ?? 0, rate).fee : 0);
  }, 0);
  const commission = Math.round(total * (sellers.find((seller) => seller.id === sellerId)?.commissionBps ?? 0) / 10000);
  const entered = payments.length === 1 ? total : payments.reduce((sum, payment) => sum + (parseReais(payment.value) ?? 0), 0);
  const patchItem = (key: number, update: Partial<Item>) => setItems(items.map((item) => item.key === key ? { ...item, ...update } : item));
  const patchPayment = (key: number, update: Partial<Payment>) => setPayments(payments.map((item) => item.key === key ? { ...item, ...update } : item));
  return <>
    {initialStore ? <label>Unidade<input value={units.find((item) => item.id === store)?.name ?? store} readOnly /></label>
      : <label>Unidade<select required value={store} onChange={(event) => {
        setStore(event.target.value);
        setSeller("");
        setItems(items.map((item) => ({ ...item, productId: "", origin: "", override: "" })));
      }}><option value="">Selecione a unidade</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <input type="hidden" name="store" value={store} />
    <label>Vendedor da unidade<select name="sellerId" value={sellerId} onChange={(event) => setSeller(event.target.value)}>
      <option value="">Sem vendedor</option>{sellers.filter((seller) => seller.store === store).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
    </select></label>
    <label>Desconto da venda (R$)<input name="discount" inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0,00" /></label>
    <fieldset className="address-fields span-two checkout-group">
      <legend>Produtos e brindes</legend>
      {items.map((item, index) => <div className="checkout-row span-two" key={item.key}>
        <label>Produto<select name="checkoutProduct" required value={item.productId} onChange={(event) => patchItem(item.key, { productId: event.target.value, origin: "", override: "" })}>
          <option value="">Selecione</option>{available.filter((product) => item.gift || product.price > 0).map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)} · {product.stock[store]} un.</option>)}</select></label>
        <label>Quantidade<input name="checkoutQuantity" type="number" min="1" max="999999" required value={item.quantity || ""} onChange={(event) => patchItem(item.key, { quantity: Number(event.target.value) })} /></label>
        <label>Tipo<select name="checkoutKind" value={item.gift ? "gift" : "sale"} onChange={(event) => patchItem(item.key, { gift: event.target.value === "gift", productId: "", origin: "", override: "" })}>
          <option value="sale">Venda</option><option value="gift">Brinde</option></select></label>
        <label>Lote da compra<select name="checkoutOrigin" required value={item.origin} onChange={(event) => patchItem(item.key, { origin: event.target.value, override: "" })}>
          <option value="">Selecione o lote</option>
          {availableLots.filter((lot) => lot.productId === item.productId).map((lot) => <option key={lot.purchaseId} value={lot.purchaseId}>{lot.consigned ? "Consignado" : "Próprio"} · {lot.supplier} · {lot.date.split("-").reverse().join("/")} · {lot.quantity} un.{showCost ? " · " + money(lot.unitCost) + "/un." : ""}</option>)}
        </select></label>
        {showCost && <label>Ajustar custo unitário (R$)<input name="checkoutCost" inputMode="decimal" maxLength={32} placeholder="Usar custo do lote"
          value={item.override ?? ""} onChange={(event) => patchItem(item.key, { override: event.target.value })} /></label>}
        {item.productId && !availableLots.some((lot) => lot.productId === item.productId) && <p className="form-note span-two">Saldo sem lote. Vincule as unidades antigas a uma compra antes de vender.</p>}
        {index > 0 && <button type="button" className="button danger" onClick={() => setItems(items.filter((row) => row.key !== item.key))}>Remover item</button>}
      </div>)}
      <button type="button" className="button" disabled={items.length >= 20} onClick={() => setItems([...items, { key: Math.max(...items.map((row) => row.key)) + 1, productId: "", quantity: 1, gift: false, origin: "" }])}>＋ Adicionar produto ou brinde</button>
    </fieldset>
    <fieldset className="address-fields span-two checkout-group">
      <legend>Pagamentos</legend>
      {payments.map((payment, index) => <div className="checkout-row span-two" key={payment.key}>
        <label>Forma<select name="checkoutMethod" value={payment.method} onChange={(event) => patchPayment(payment.key, { method: paymentMethods.find((item) => item === event.target.value) ?? "Pix" })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Valor (R$)<input name="checkoutAmount" inputMode="decimal" readOnly={payments.length === 1} value={payments.length === 1 ? (total / 100).toFixed(2).replace(".", ",") : payment.value} required onChange={(event) => patchPayment(payment.key, { value: event.target.value })} /></label>
        {payment.method === "Cartão" ? <label>Taxa da maquininha<select name="checkoutRate" required value={payment.rateId} onChange={(event) => patchPayment(payment.key, { rateId: event.target.value })}>
          <option value="">Selecione</option>{rates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {rate.mode} · {rate.installments}x · {rate.basisPoints / 100}%</option>)}</select></label> : <input type="hidden" name="checkoutRate" value="" />}
        <label>Recebimento<select name="checkoutStatus" value={payment.received ? "received" : "pending"} onChange={(event) => patchPayment(payment.key, { received: event.target.value === "received" })}>
          <option value="received">Já recebido</option><option value="pending">A receber</option></select></label>
        {payment.received ? <input type="hidden" name="checkoutDue" value="" /> : <label>Vencimento<input name="checkoutDue" type="date" required value={payment.due} onChange={(event) => patchPayment(payment.key, { due: event.target.value })} /></label>}
        {index > 0 && <button type="button" className="button danger" onClick={() => setPayments(payments.filter((row) => row.key !== payment.key))}>Remover pagamento</button>}
      </div>)}
      <button type="button" className="button" disabled={payments.length >= 12} onClick={() => setPayments([...payments, { key: Math.max(...payments.map((row) => row.key)) + 1, method: "Pix", value: "", rateId: "", received: true, due: "" }])}>＋ Adicionar pagamento</button>
    </fieldset>
    <fieldset className="address-fields span-two checkout-group">
      <legend>Imposto da venda</legend>
      <label>Como calcular<select value={taxMode} onChange={(event) => setTaxMode(event.target.value)}>
        <option value="">{defaultTax ? "Usar imposto padrão" : "Sem alíquota cadastrada"}</option>
        {taxRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {(rate.basisPoints / 100).toLocaleString("pt-BR")}%{rate.defaultForSale ? " · padrão" : ""}</option>)}
        <option value="manual">Informar valor manual</option>
      </select></label>
      <input type="hidden" name="taxRateId" value={taxMode === "manual" ? "" : taxMode} />
      <input type="hidden" name="taxMode" value={taxMode === "manual" ? "manual" : "rate"} />
      {taxMode === "manual" ? <label>Imposto (R$)<input name="manualTax" inputMode="decimal" required maxLength={32} value={manualTax} onChange={(event) => setManualTax(event.target.value)} /></label>
        : <p className="form-note">Imposto estimado sobre o valor após desconto: <strong>{money(tax)}</strong></p>}
    </fieldset>
    <div className="dashboard-values checkout-summary span-two">
      <div><p>Total da venda</p><strong>{money(total)}</strong></div>
      <div><p>Imposto estimado</p><strong>{money(tax)}</strong></div>
      <div><p>Taxas de cartão</p><strong>{money(fees)}</strong></div>
      <div><p>Recebido líquido estimado</p><strong>{money(receivedGross - receivedFees)}</strong></div>
      <div><p>A receber</p><strong>{money(entered - receivedGross)}</strong></div>
      {showCost && <>
        <div><p>Custo dos itens e brindes</p><strong>{money(cost)}</strong>{missingCost && <small>Há itens sem custo cadastrado</small>}</div>
        <div><p>Comissão estimada</p><strong>{money(commission)}</strong></div>
        <div><p>Margem estimada da venda</p><strong>{missingCost ? "Custo incompleto" : money(total - fees - tax - cost - commission)}</strong></div>
      </>}
      {entered !== total && <div><p>{entered < total ? "Falta distribuir" : "Valor acima do total"}</p><strong>{money(Math.abs(total - entered))}</strong></div>}
    </div>
  </>;
}
