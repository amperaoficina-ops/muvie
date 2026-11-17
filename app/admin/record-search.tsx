"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function RecordSearch({ tab, store, category, stage, query, view }: { tab: string; store: string; category?: string; stage?: string; view?: string; query: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [value, setValue] = useState(query);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function search(text: string, delay = 0) {
    setValue(text);
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams({ tab });
    if (store) params.set("loja", store);
    if (category) params.set("categoria", category);
    if (view) params.set("estoqueVisao", view);
    if (stage) params.set("etapa", stage);
    if (text.trim()) params.set("busca", text.trim());
    timer.current = setTimeout(() => router.replace("/admin?" + params, { scroll: false }), delay);
  }

  return <form className="workspace-section-links admin-record-search" role="search"
    onSubmit={(event) => { event.preventDefault(); search(value); }}>
    <input type="search" maxLength={100} value={value} onChange={(event) => search(event.target.value, 300)}
      aria-label="Pesquisar registros" placeholder={tab === "contratos" ? "Nome do documento ou arquivo" : tab === "crm" ? "Nome, CPF, telefone ou e-mail" : tab === "compras" ? "Produto, SKU ou fornecedor" : "Produto, SKU ou categoria"} />
    {value && <button className="button" type="button" onClick={() => search("")}>Limpar busca</button>}
  </form>;
}
