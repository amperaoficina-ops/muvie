"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function SaleDialog({ children, reopen }: { children: ReactNode; reopen: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    function openFromHash() {
      if (location.hash === "#nova-venda" && !dialog.current?.open) dialog.current?.showModal();
    }
    function openFromLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element) || !event.target.closest('a[href="#nova-venda"]')) return;
      event.preventDefault();
      if (!dialog.current?.open) dialog.current?.showModal();
    }
    if (reopen) dialog.current?.showModal();
    else openFromHash();
    window.addEventListener("hashchange", openFromHash);
    document.addEventListener("click", openFromLink);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("click", openFromLink);
    };
  }, [reopen]);

  return <dialog ref={dialog} className="unit-dialog sale-dialog panel" aria-labelledby="nova-venda-titulo"
    onClose={() => {
      if (location.hash === "#nova-venda") history.replaceState(history.state, "", location.pathname + location.search);
    }}
    onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="unit-dialog-body">
      <div className="panel-title">
        <h2 id="nova-venda-titulo">Nova venda</h2>
        <button className="button" type="button" aria-label="Fechar nova venda" onClick={() => dialog.current?.close()}>×</button>
      </div>
      {children}
    </div>
  </dialog>;
}

export function SaleDetailsDialog({ id, children, reopen }: { id: string; children: ReactNode; reopen: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (reopen && !dialog.current?.open) dialog.current?.showModal();
  }, [reopen]);

  return <>
    <button type="button" className="button" onClick={() => dialog.current?.showModal()}>Ver detalhes</button>
    <dialog ref={dialog} className="unit-dialog sale-dialog panel" aria-labelledby={id}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="unit-dialog-body">
        <div className="panel-title">
          <h2 id={id}>Detalhes da venda</h2>
          <button type="button" className="button" aria-label="Fechar detalhes" onClick={() => dialog.current?.close()}>×</button>
        </div>
        {children}
      </div>
    </dialog>
  </>;
}
