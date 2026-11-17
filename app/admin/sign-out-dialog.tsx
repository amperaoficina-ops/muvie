"use client";

import { useId, useRef } from "react";
import { signOut } from "../login/actions";
import { Submit } from "./submit";

export function SignOutDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();

  return <>
    <button type="button" className="button sidebar-sign-out" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      Sair
    </button>
    <dialog ref={dialog} className="unit-dialog sign-out-dialog panel" aria-labelledby={title}>
      <div className="unit-dialog-body">
        <div className="panel-title"><h2 id={title}>Sair do backoffice?</h2></div>
        <form action={signOut} className="sign-out-actions">
          <button autoFocus type="button" className="button" onClick={() => dialog.current?.close()}>Continuar conectado</button>
          <Submit variant="danger">Sair</Submit>
        </form>
      </div>
    </dialog>
  </>;
}
