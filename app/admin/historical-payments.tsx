"use client";

import { useState } from "react";
import { money, paymentMethods, type HistoricalPayment } from "@/domain/retail";
import { saveHistoricalPayments } from "./actions";
import { Submit } from "./submit";

const reais = (value: number) => (value / 100).toFixed(2).replace(".", ",");

export function HistoricalPayments({ rows, total, saleId, filter, date }: {
  rows: HistoricalPayment[]; total: number; saleId: string; filter: string; date: string;
}) {
  const [payments, setPayments] = useState(rows.map((row, key) => ({ ...row, key })));
  const [nextKey, setNextKey] = useState(rows.length);
  return <details className="sale-detail-card">
    <summary>Corrigir pagamentos antigos</summary>
    <form action={saveHistoricalPayments} className="admin-form">
      <input type="hidden" name="filter" value={filter} /><input type="hidden" name="focus" value={saleId} />
      <input type="hidden" name="historyCount" value={payments.length} />
      <p className="form-note span-two">Divida o total de {money(total)} entre as formas usadas. Para recebimentos em datas diferentes, use uma linha para cada baixa.</p>
      {payments.map((row, index) => <fieldset className="span-two admin-form" key={row.key}>
        <legend>Pagamento {index + 1}</legend>
        <input type="hidden" name={"historySource" + index} value={row.source ?? ""} />
        <label>Forma de pagamento<select name={"historyMethod" + index} value={row.method} onChange={(event) => {
          const method = paymentMethods.find((item) => item === event.target.value);
          if (method) setPayments((current) => current.map((item) => item.key === row.key ? { ...item, method } : item));
        }}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Valor bruto (R$)<input name={"historyAmount" + index} defaultValue={row.amount ? reais(row.amount) : ""} required inputMode="decimal" maxLength={32} /></label>
        {row.method === "Cartão" && <label>Taxa descontada (R$)<input name={"historyFee" + index} defaultValue={reais(row.fee)} required inputMode="decimal" maxLength={32} /></label>}
        {row.method === "Produto" && <label>Bem recebido<input name={"historyAsset" + index} defaultValue={row.assetDescription} required maxLength={140} /></label>}
        <label>Status<select name={"historyStatus" + index} value={row.status} onChange={(event) => {
          const status = event.target.value === "received" ? "received" : "pending";
          setPayments((current) => current.map((item) => item.key === row.key ? { ...item, status } : item));
        }}><option value="received">Recebido</option><option value="pending">A receber</option></select></label>
        <label>{row.status === "received" ? "Data efetiva do recebimento" : "Vencimento"}<input type="date" name={"historyDate" + index} defaultValue={row.date} min={date} required /></label>
        {payments.length > 1 && <div><button className="button" type="button" onClick={() => setPayments((current) => current.filter((item) => item.key !== row.key))}>Remover pagamento</button></div>}
      </fieldset>)}
      {payments.length < 30 && <div className="span-two"><button className="button" type="button" onClick={() => {
        setPayments((current) => [...current, { key: nextKey, method: "Pix", amount: 0, fee: 0, status: "received", date }]);
        setNextKey(nextKey + 1);
      }}>＋ Adicionar forma de pagamento</button></div>}
      <label className="checkbox span-two"><input type="checkbox" name="confirmed" required /> Confirmo a substituição dos pagamentos registrados. A correção recalcula as entradas do caixa.</label>
      <div className="span-two"><Submit>Salvar pagamentos</Submit></div>
    </form>
  </details>;
}
