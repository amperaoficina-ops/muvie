"use client";

import { useState } from "react";
import { productColors, type ProductColor } from "@/domain/product-colors";
import { SearchSelect } from "./search-select";

export function LotColorFields({ total = 1, initial, editing = false }: {
  total?: number; initial?: { color?: ProductColor; quantity: number }[]; editing?: boolean;
}) {
  const [quantity, setQuantity] = useState(String(total));
  const [rows, setRows] = useState((initial ?? [{ quantity: total }]).map((row, index) => ({
    id: index, color: row.color ?? "none", quantity: String(row.quantity),
  })));
  const difference = Number(quantity) - rows.reduce((sum, row) => sum + Number(row.quantity), 0);
  return <fieldset className="address-fields span-two checkout-group">
    <legend>Cores do lote</legend>
    <label>Quantidade total<input name="quantity" type="number" min={1} max={999999} required readOnly={editing} value={quantity}
      onChange={(event) => setQuantity(event.target.value)} /></label>
    {rows.map((row, index) => <div className="checkout-row span-two" key={row.id}>
      <label>Cor<SearchSelect name="lotColor" required value={row.color} onChange={(event) => {
        setRows(rows.map((item) => item.id === row.id ? { ...item, color: event.target.value } : item));
      }}>
        <option value="" disabled>Selecione uma cor</option>
        <option value="none">Sem cor definida</option>
        {productColors.map((color) => <option key={color}>{color}</option>)}
      </SearchSelect></label>
      <label>Unidades desta cor<input name="lotColorQuantity" type="number" min={1} max={999999} required
        readOnly={rows.length === 1} value={rows.length === 1 ? quantity : row.quantity}
        onChange={(event) => setRows(rows.map((item) => item.id === row.id ? { ...item, quantity: event.target.value } : item))} /></label>
      {rows.length > 1 && <button type="button" className="button danger" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remover cor</button>}
    </div>)}
    {rows.length > 1 && <p className="form-note span-two" role="status">{difference > 0 ? "Faltam distribuir " + difference + " unidade(s)." :
      difference < 0 ? "As cores excedem o total em " + -difference + " unidade(s)." : "As cores somam a quantidade total."}</p>}
    <button type="button" className="button" disabled={rows.length >= productColors.length + 1}
      onClick={() => setRows([...rows.map((row) => rows.length === 1 ? { ...row, quantity } : row),
        { id: Math.max(...rows.map((row) => row.id)) + 1, color: "", quantity: "" }])}>＋ Adicionar cor</button>
  </fieldset>;
}
