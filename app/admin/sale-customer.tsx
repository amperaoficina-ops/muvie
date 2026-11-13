"use client";

import { useState } from "react";

export function SaleCustomer({ contacts }: { contacts: { id: string; label: string }[] }) {
  const [mode, setMode] = useState("walk-in");
  return <fieldset className="address-fields span-two">
    <legend>Cliente</legend>
    <label>Como identificar o cliente<select name="customerMode" value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="walk-in">Informar nome na venda</option>
      <option value="existing" disabled={!contacts.length}>Vincular cliente cadastrado</option>
      <option value="new">Cadastrar novo cliente nesta venda</option>
    </select></label>
    {mode === "existing" ? <label>Cliente cadastrado<select name="contactId" required defaultValue="">
      <option value="" disabled>Selecione um cliente</option>
      {contacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.label}</option>)}
    </select></label> : <label>Nome do cliente<input name="customer" required maxLength={100} /></label>}
    {mode === "new" && <>
      <label>Telefone<input name="phone" type="tel" maxLength={32} /></label>
      <label>E-mail<input name="email" type="email" maxLength={254} /></label>
      <label>CPF<input name="cpf" inputMode="numeric" maxLength={20} /></label>
      <p className="form-note span-two">Ao confirmar a venda, a ficha será criada no CRM da unidade escolhida e vinculada ao histórico.</p>
    </>}
  </fieldset>;
}
