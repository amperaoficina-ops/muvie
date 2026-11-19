"use client";

import { CardPaymentFields } from "./card-payment-fields";
import { SearchSelect } from "./search-select";
import { useState } from "react";
import { stockLotId, money, paymentMethods, cardQuote, percentageAmount, type TaxRate, type CardMachine, type CardRate, type Product, type StockLot, type Store } from "@/domain/retail";
import { completePaymentAmounts, parseReais } from "@/domain/money-input";

type Item = { key: number; productId: string; quantity: number; gift: boolean; origin: string; purchaseId?: string; override?: string };
type Payment = { assetDescription?: string; key: number; method: typeof paymentMethods[number]; value: string; rateId: string; machineId: string; received: boolean; due: string };
type SaleProduct = Pick<Product, "id" | "name" | "sku" | "price" | "stock">;

export function CheckoutFields({ units, initialStore, products, lots, rates, machines, sellers, showCost, taxRates, restricted }: {
  units: readonly Store[]; initialStore: string; products: SaleProduct[]; lots: StockLot[]; rates: CardRate[]; machines: CardMachine[]; taxRates: TaxRate[]; sellers: { id: string; name: string; store: string }[]; showCost: boolean; restricted: boolean;
}) {
  const [store, setStore] = useState(initialStore);
  const [items, setItems] = useState<Item[]>([{ key: 0, productId: "", quantity: 1, gift: false, origin: "" }]);
  const [payments, setPayments] = useState<Payment[]>([{ key: 0, method: "Pix", value: "", rateId: "", machineId: "", received: true, due: "" }]);
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
    for (const lot of availableLots.filter((lot) => lot.productId === item.productId && item.origin === stockLotId(lot))) {
      const quantity = Math.min(remaining, Math.max(0, lot.quantity - (usedLots.get(stockLotId(lot)) ?? 0)));
      lotCost += quantity * lot.unitCost;
      remaining -= quantity;
      usedLots.set(stockLotId(lot), (usedLots.get(stockLotId(lot)) ?? 0) + quantity);
    }
    const override = item.override?.trim() ? parseReais(item.override) : lotCost;
    if (remaining || override === null) missingCost = true;
    else cost += item.override?.trim() ? override * item.quantity : override;
  }
  const amounts = completePaymentAmounts(total, payments.map((payment) => payment.value));
  const fees = payments.reduce((sum, payment, index) => {
    const rate = payment.method === "Cartão" ? rates.find((item) => item.id === payment.rateId) : undefined;
    return sum + (rate ? cardQuote(parseReais(amounts[index]) ?? 0, rate).fee : 0);
  }, 0);
  const receivedGross = payments.reduce((sum, payment, index) => sum + (payment.received ? (parseReais(amounts[index]) ?? 0) : 0), 0);
  const receivedInProducts = payments.reduce((sum, payment, index) => sum +
    (payment.received && payment.method === "Produto" ? parseReais(amounts[index]) ?? 0 : 0), 0);
  const receivedFees = payments.reduce((sum, payment, index) => {
    const rate = payment.received && payment.method === "Cartão" ? rates.find((item) => item.id === payment.rateId) : undefined;
    return sum + (rate ? cardQuote(parseReais(amounts[index]) ?? 0, rate).fee : 0);
  }, 0);
  const entered = amounts.reduce((sum, value) => sum + (parseReais(value) ?? 0), 0);
  const patchItem = (key: number, update: Partial<Item>) => setItems(items.map((item) => item.key === key ? { ...item, ...update } : item));
  const patchPayment = (key: number, update: Partial<Payment>) => setPayments(payments.map((item) => item.key === key ? { ...item, ...update } : item));
  return <>
    {initialStore ? <label>Unidade<input value={units.find((item) => item.id === store)?.name ?? store} readOnly /></label>
      : <label>Unidade<select required value={store} onChange={(event) => {
        setStore(event.target.value);
        setSeller("");
        setItems(items.map((item) => ({ ...item, productId: "", origin: "", purchaseId: "", override: "" })));
      }}><option value="">Selecione a unidade</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <input type="hidden" name="store" value={store} />
    <label>Vendedor da unidade<SearchSelect name="sellerId" required={restricted} value={sellerId} onChange={(event) => setSeller(event.target.value)}>
      <option value="" disabled={restricted}>{restricted ? "Selecione o vendedor" : "Sem vendedor"}</option>{sellers.filter((seller) => seller.store === store).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
    </SearchSelect></label>
    <label>Desconto da venda (R$)<input name="discount" inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0,00" /></label>
    <fieldset className="address-fields span-two checkout-group">
      <legend>Produtos e brindes</legend>
      {items.map((item, index) => {
        const productLots = availableLots.filter((lot) => lot.productId === item.productId);
        const purchases = [...new Map(productLots.map((lot) => [lot.purchaseId, lot])).values()];
        const colorLots = productLots.filter((lot) => lot.purchaseId === item.purchaseId);
        const selected = colorLots.find((lot) => stockLotId(lot) === item.origin);
        const usedElsewhere = items.filter((row) => row.key !== item.key && row.productId === item.productId && row.origin === item.origin)
          .reduce((sum, row) => sum + row.quantity, 0);
        const remaining = selected ? Math.max(0, selected.quantity - usedElsewhere) : 0;
        return <div className="checkout-row span-two" key={item.key}>
        <label>Produto<SearchSelect name="checkoutProduct" required value={item.productId} onChange={(event) => patchItem(item.key, { productId: event.target.value, origin: "", purchaseId: "", override: "" })}>
          <option value="">Selecione</option>{available.filter((product) => item.gift || product.price > 0).map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)} · {product.stock[store]} un.</option>)}</SearchSelect></label>
        <label>Quantidade<input name="checkoutQuantity" type="number" min="1" max={selected ? remaining : 999999} required value={item.quantity || ""} onChange={(event) => patchItem(item.key, { quantity: Number(event.target.value) })} /></label>
        <label>Tipo<SearchSelect name="checkoutKind" value={item.gift ? "gift" : "sale"} onChange={(event) => patchItem(item.key, { gift: event.target.value === "gift", productId: "", origin: "", purchaseId: "", override: "" })}>
          <option value="sale">Venda</option><option value="gift">Brinde</option></SearchSelect></label>
        <label>Lote da compra<SearchSelect required value={item.purchaseId ?? ""} onChange={(event) => patchItem(item.key, { purchaseId: event.target.value, origin: "", override: "" })}>
          <option value="">Selecione o lote</option>
          {purchases.map((lot) => <option key={lot.purchaseId} value={lot.purchaseId}>
            {lot.supplier} · {lot.date.split("-").reverse().join("/")} · {lot.consigned ? "Consignado" : "Próprio"} · {productLots.filter((row) => row.purchaseId === lot.purchaseId).reduce((sum, row) => sum + row.quantity, 0)} un. · {lot.purchaseId.slice(0, 8)}
          </option>)}
        </SearchSelect></label>
        <label>Cor do lote<SearchSelect name="checkoutOrigin" required value={item.origin}
          onChange={(event) => patchItem(item.key, { origin: event.target.value, override: "" })}>
          <option value="">{item.purchaseId ? "Selecione a cor" : "Selecione o lote primeiro"}</option>
          {colorLots.map((lot) => {
            const used = items.filter((row) => row.key !== item.key && row.productId === item.productId && row.origin === stockLotId(lot))
              .reduce((sum, row) => sum + row.quantity, 0);
            const availableQuantity = Math.max(0, lot.quantity - used);
            return <option key={stockLotId(lot)} value={stockLotId(lot)} disabled={!availableQuantity}>
              {lot.color ?? "Sem cor definida"} · {availableQuantity} un.{showCost ? " · " + money(lot.unitCost) + "/un." : ""}
            </option>;
          })}
        </SearchSelect></label>
        {selected && <p className="form-note">Disponível nesta cor: {remaining} un.</p>}
        {showCost && <label>Ajustar custo unitário (R$)<input name="checkoutCost" inputMode="decimal" maxLength={32} placeholder="Usar custo do lote"
          value={item.override ?? ""} onChange={(event) => patchItem(item.key, { override: event.target.value })} /></label>}
        {item.productId && !availableLots.some((lot) => lot.productId === item.productId) && <p className="form-note span-two">Saldo sem lote. Vincule as unidades antigas a uma compra antes de vender.</p>}
        {index > 0 && <button type="button" className="button danger" onClick={() => setItems(items.filter((row) => row.key !== item.key))}>Remover item</button>}
      </div>;
      })}
      <button type="button" className="button" disabled={items.length >= 20} onClick={() => setItems([...items, { key: Math.max(...items.map((row) => row.key)) + 1, productId: "", quantity: 1, gift: false, origin: "" }])}>＋ Adicionar produto ou brinde</button>
    </fieldset>
    <fieldset className="address-fields span-two checkout-group">
      <legend>Pagamentos</legend>
      {payments.map((payment, index) => <div className="checkout-row span-two" key={payment.key}>
        <label>Forma<SearchSelect name="checkoutMethod" value={payment.method} onChange={(event) => {
          const method = paymentMethods.find((item) => item === event.target.value) ?? "Pix";
          patchPayment(payment.key, { method, ...(restricted && method === "Cartão" ? { received: false } : {}) });
        }}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</SearchSelect></label>
        <label>{index === payments.length - 1 ? "Saldo automático (R$)" : "Valor (R$)"}<input name="checkoutAmount" inputMode="decimal" readOnly={index === payments.length - 1} value={amounts[index]} required onChange={(event) => patchPayment(payment.key, { value: event.target.value })} /></label>
        {payment.method === "Cartão" ? <CardPaymentFields machines={machines} rates={rates} machineId={payment.machineId} rateId={payment.rateId}
          names={{ machine: "checkoutMachine", rate: "checkoutRate" }} onChange={(machineId, rateId) => patchPayment(payment.key, { machineId, rateId })} />
          : <><input type="hidden" name="checkoutMachine" value="" /><input type="hidden" name="checkoutRate" value="" /></>}
        {payment.method === "Produto" ? <label>Bem recebido na troca<input name="checkoutAsset" required={restricted} maxLength={120}
          placeholder="Ex.: scooter X13 usada, celular ou carro" value={payment.assetDescription ?? ""}
          onChange={(event) => patchPayment(payment.key, { assetDescription: event.target.value })} /></label>
          : <input type="hidden" name="checkoutAsset" value="" />}
        <label>Recebimento<SearchSelect name="checkoutStatus" value={payment.received ? "received" : "pending"} onChange={(event) => patchPayment(payment.key, { received: event.target.value === "received" })}>
          <option value="received" disabled={restricted && payment.method === "Cartão"}>Já recebido</option><option value="pending">{restricted && payment.method === "Cartão" ? "A conciliar no Caixa" : "A receber"}</option></SearchSelect></label>
        {payment.received ? <input type="hidden" name="checkoutDue" value="" /> : <label>Vencimento<input name="checkoutDue" type="date" required value={payment.due} onChange={(event) => patchPayment(payment.key, { due: event.target.value })} /></label>}
        {index > 0 && <button type="button" className="button danger" onClick={() => setPayments(payments.filter((row) => row.key !== payment.key))}>Remover pagamento</button>}
      </div>)}
      <button type="button" className="button" disabled={payments.length >= 12} onClick={() => setPayments([...payments, { key: Math.max(...payments.map((row) => row.key)) + 1, method: "Pix", value: "", rateId: "", machineId: "", received: true, due: "" }])}>＋ Adicionar pagamento</button>
    </fieldset>
    <fieldset className="address-fields span-two checkout-group">
      <legend>Imposto da venda</legend>
      {restricted && !defaultTax && <p className="feedback error span-two" role="alert">A Diretoria precisa cadastrar o imposto padrão antes de você fechar a venda.</p>}
      {!restricted && <label>Como calcular<SearchSelect value={taxMode} onChange={(event) => setTaxMode(event.target.value)}>
        <option value="">{defaultTax ? "Usar imposto padrão" : "Sem alíquota cadastrada"}</option>
        {taxRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {(rate.basisPoints / 100).toLocaleString("pt-BR")}%{rate.defaultForSale ? " · padrão" : ""}</option>)}
        <option value="manual">Informar valor manual</option>
      </SearchSelect></label>}
      <input type="hidden" name="taxRateId" value={taxMode === "manual" ? "" : taxMode} />
      <input type="hidden" name="taxMode" value={taxMode === "manual" ? "manual" : "rate"} />
      {taxMode === "manual" ? <label>Imposto (R$)<input name="manualTax" inputMode="decimal" required maxLength={32} value={manualTax} onChange={(event) => setManualTax(event.target.value)} /></label>
        : <p className="form-note">Imposto estimado sobre o valor após desconto: <strong>{money(tax)}</strong></p>}
    </fieldset>
    <div className="dashboard-values checkout-summary span-two">
      <div><p>Total da venda</p><strong>{money(total)}</strong></div>
      <div><p>Imposto estimado</p><strong>{money(tax)}</strong></div>
      <div><p>Taxas de cartão</p><strong>{money(fees)}</strong></div>
      <div><p>Recebido líquido estimado em caixa</p><strong>{money(receivedGross - receivedInProducts - receivedFees)}</strong></div>
      <div><p>A receber</p><strong>{money(entered - receivedGross)}</strong></div>
      {showCost && <>
        <div><p>Custo dos itens e brindes</p><strong>{money(cost)}</strong>{missingCost && <small>Há itens sem custo cadastrado</small>}</div>
        <div><p>Margem antes da comissão</p><strong>{missingCost ? "Custo incompleto" : money(total - fees - tax - cost)}</strong></div>
      </>}
      {entered !== total && <div><p>{entered < total ? "Falta distribuir" : "Valor acima do total"}</p><strong>{money(Math.abs(total - entered))}</strong></div>}
    </div>
  </>;
}
