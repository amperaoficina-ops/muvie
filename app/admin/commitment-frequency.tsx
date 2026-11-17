"use client";

import { useState } from "react";
import { SearchSelect } from "./search-select";

export function CommitmentFrequency() {
  const [frequency, setFrequency] = useState("monthly");
  return <>
    <label>Frequência<SearchSelect name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
      <option value="monthly">Mensal · lançamento único</option>
      <option value="fixed">Fixo · repetir todo mês</option>
    </SearchSelect></label>
    {frequency === "fixed" && <label>Total de meses (inclui o primeiro)
      <input type="number" name="repeatMonths" min={1} max={120} placeholder="Em branco: até encerrar" />
    </label>}
  </>;
}
