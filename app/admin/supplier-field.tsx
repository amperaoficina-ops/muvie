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
    {selected === "new" && <label>Nome do novo fornecedor<input name="supplierName" maxLength={100} required /></label>}
  </>;
}
