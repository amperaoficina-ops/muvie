"use client";

import { SearchSelect } from "./search-select";
import { useState } from "react";
import type { Product, StockLot, Store } from "@/domain/retail";

export function StockFields({ units, products, lots, initialStore }: { units: readonly Store[]; initialStore: string; products: Pick<Product, "id" | "name" | "sku">[]; lots: Pick<StockLot, "purchaseId" | "productId" | "store" | "color" | "quantity" | "supplier">[] }) {
  const [mode, setMode] = useState("transferencia");
  const [store, setStore] = useState(initialStore);
  const [product, setProduct] = useState("");
  const [origin, setOrigin] = useState("");
  const matching = lots.filter((lot) => lot.productId === product && lot.store === store && lot.quantity > 0);
  return <>
    <label>Produto<SearchSelect name="productId" required value={product} onChange={(event) => { setProduct(event.target.value); setOrigin(""); }}>
      <option value="" disabled>Selecione um produto</option>
      {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
    </SearchSelect></label>
    <label>Unidade de origem<select name="store" value={store} onChange={(event) => { setStore(event.target.value); setOrigin(""); }} required>
      <option value="" disabled>Selecione a unidade</option>
      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </select></label>
    {matching.length > 0 && <label>Lote e cor<SearchSelect name="stockOrigin" value={origin} onChange={(event) => setOrigin(event.target.value)}>
      <option value="">Automático · lotes mais antigos</option>
      {matching.map((lot) => <option key={lot.purchaseId} value={lot.purchaseId}>{lot.color ?? "Sem cor definida"} · {lot.supplier} · {lot.quantity} un.</option>)}
    </SearchSelect></label>}

    <label>Operação<SearchSelect name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="transferencia">Transferir entre unidades</option>
      <option value="saida">Registrar perda ou retirada</option>
    </SearchSelect></label>
    <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue="1" required /></label>
    {mode === "transferencia" ? <label>Destino<select name="destination" defaultValue="" required>
      <option value="" disabled>Selecione a unidade</option>
      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </select></label> : <label className="span-two">Motivo<input name="reason" maxLength={100} required /></label>}
  </>;
}
