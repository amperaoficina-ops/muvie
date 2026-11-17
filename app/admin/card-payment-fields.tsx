"use client";

import { cardMachineIsActive, cardMachineOptions, rateMachineId, type CardMachine, type CardRate } from "@/domain/retail";
import { SearchSelect } from "./search-select";

export function CardPaymentFields({ machines, rates, machineId, rateId, onChange, names }: {
  machines: CardMachine[]; rates: CardRate[]; machineId: string; rateId: string;
  onChange: (machineId: string, rateId: string) => void;
  names?: { machine: string; rate: string };
}) {
  const options = cardMachineOptions(machines, rates).filter((item) => !item.inactive);
  const conditions = rates.filter((rate) => rateMachineId(rate) === machineId && cardMachineIsActive(machines, machineId));
  return <>
    <label>Maquininha<SearchSelect name={names?.machine} required value={machineId} onChange={(event) => onChange(event.target.value, "")}>
      <option value="" disabled>{options.length ? "Selecione a maquininha" : "Nenhuma maquininha cadastrada"}</option>
      {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </SearchSelect></label>
    <label>Condição de cartão<SearchSelect name={names?.rate} required value={rateId} onChange={(event) => onChange(machineId, event.target.value)}>
      <option value="" disabled>{!machineId ? "Selecione a maquininha primeiro" : conditions.length ? "Selecione a condição" : "Sem taxas nesta maquininha"}</option>
      {conditions.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {rate.mode} · {rate.installments}× · {rate.basisPoints / 100}%</option>)}
    </SearchSelect></label>
  </>;
}
