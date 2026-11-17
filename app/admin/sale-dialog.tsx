"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function CreateDialog({ children, reopen, id, title }: { children: ReactNode; reopen: boolean; id: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    function openFromHash() {
      if (location.hash === "#" + id && !dialog.current?.open) dialog.current?.showModal();
    }
    function openFromLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element) || !event.target.closest(`a[href="#${id}"]`)) return;
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
  }, [id, reopen]);

  return <dialog ref={dialog} className="unit-dialog sale-dialog panel" aria-labelledby={id + "-titulo"}
    onClose={() => {
      if (location.hash === "#" + id) history.replaceState(history.state, "", location.pathname + location.search);
    }}
    onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="unit-dialog-body">
      <div className="panel-title">
        <h2 id={id + "-titulo"}>{title}</h2>
        <button className="button" type="button" aria-label="Fechar formulário" onClick={() => dialog.current?.close()}>×</button>
      </div>
      {children}
    </div>
  </dialog>;
}

export function DetailsDialog({ id, children, reopen, title, trigger = "Ver detalhes", danger = false }: { id: string; children: ReactNode; reopen?: boolean; title: string; trigger?: string; danger?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (reopen && !dialog.current?.open) dialog.current?.showModal();
  }, [reopen]);

  return <>
    <button type="button" className={danger ? "button danger" : "button"} onClick={() => dialog.current?.showModal()}>{trigger}</button>
    <dialog ref={dialog} className="unit-dialog sale-dialog panel" aria-labelledby={id}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="unit-dialog-body">
        <div className="panel-title">
          <h2 id={id}>{title}</h2>
          <button type="button" className="button" aria-label="Fechar detalhes" onClick={() => dialog.current?.close()}>×</button>
        </div>
        {children}
      </div>
    </dialog>
  </>;
}
