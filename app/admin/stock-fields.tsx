"use client";

import { useState } from "react";
import type { Store } from "@/domain/retail";

export function StockFields({ units }: { units: readonly Store[] }) {
  const [mode, setMode] = useState("entrada");
  const consignment = mode === "consignada" || mode === "classificar";
  return <>
    <label>Operação<select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="entrada">Entrada própria (ajuste)</option>
      <option value="consignada">Entrada consignada</option>
      <option value="classificar">Classificar saldo avulso como consignado</option>
      <option value="saida">Saída</option>
      <option value="transferencia">Transferir entre unidades</option>
    </select></label>
    <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue="1" required /></label>
    {mode === "transferencia" && <label>Destino<select name="destination" defaultValue="" required>
      <option value="" disabled>Selecione a unidade</option>
      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </select></label>}
    {consignment && <>
      <label>Fornecedor<input name="supplier" maxLength={100} required /></label>
      <label>Custo unitário de repasse (R$)<input name="unitCost" type="number" min=".01" step=".01" max="99999999.99" required /></label>
    </>}
    {(mode === "entrada" || mode === "saida") && <label className="span-two">Motivo<input name="reason" maxLength={100} required /></label>}
    {mode === "classificar" && <p className="form-note span-two">Use para unidades já existentes sem lote. O saldo total permanece igual.</p>}
  </>;
}
