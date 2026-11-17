"use client";

import { useState } from "react";
import { SearchSelect } from "./search-select";
import type { Supplier } from "@/domain/retail";

export function SupplierField({ suppliers }: { suppliers: Pick<Supplier, "id" | "name">[] }) {
  const [selected, setSelected] = useState("");
  return <>
    <label>Fornecedor<SearchSelect name="supplierId" value={selected} onChange={(event) => setSelected(event.target.value)}>
      <option value="">Selecione ou vincule um cliente</option>
      <option value="new">＋ Cadastrar novo fornecedor</option>
      {suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((supplier) =>
        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
    </SearchSelect></label>
    {selected === "new" && <fieldset className="address-fields span-two">
      <legend>Novo fornecedor</legend>
      <label className="span-two">Nome ou razão social<input name="supplierName" maxLength={100} required /></label>
      <label>CNPJ<input name="supplierCnpj" maxLength={24} placeholder="00.000.000/0000-00" /></label>
      <label>Localização<input name="supplierLocation" maxLength={180} placeholder="Endereço, cidade e UF" /></label>
    </fieldset>}
  </>;
}
