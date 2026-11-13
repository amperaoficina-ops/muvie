"use client";

import { useRef } from "react";
import { saveUnit } from "./actions";
import { Submit } from "./submit";

export function UnitDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="button yellow" type="button" onClick={() => dialog.current?.showModal()}>＋ Adicionar unidade</button>
    <dialog ref={dialog} className="unit-dialog panel" aria-labelledby="unit-dialog-title" onClick={(event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    }}>
      <div className="unit-dialog-body">
        <div className="panel-title"><h2 id="unit-dialog-title">Adicionar unidade</h2>
          <button type="button" className="button" aria-label="Fechar" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <form action={saveUnit} className="admin-form">
          <label>Nome da unidade<input name="name" maxLength={70} required /></label>
          <label>Sigla<input name="code" minLength={2} maxLength={8} pattern="[A-Za-z0-9]{2,8}" required /></label>
          <div className="unit-dialog-actions span-two">
            <button type="button" className="button" onClick={() => dialog.current?.close()}>Cancelar</button>
            <Submit>Cadastrar unidade</Submit>
          </div>
        </form>
      </div>
    </dialog>
  </>;
}
