"use client";

import { useState } from "react";
import type { Store } from "@/domain/retail";

export function StockFields({ units }: { units: readonly Store[] }) {
  const [mode, setMode] = useState("transferencia");
  return <>
    <label>Operação<select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="transferencia">Transferir entre unidades</option>
      <option value="saida">Registrar perda ou retirada</option>
    </select></label>
    <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue="1" required /></label>
    {mode === "transferencia" ? <label>Destino<select name="destination" defaultValue="" required>
      <option value="" disabled>Selecione a unidade</option>
      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </select></label> : <label className="span-two">Motivo<input name="reason" maxLength={100} required /></label>}
  </>;
}
