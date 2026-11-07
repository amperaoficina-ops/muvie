"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import { scooterFields, type ScooterSpecs } from "@/domain/scooter";
import { Icon, instagram } from "./brand";

export function ModelDetails({ name, imageUrl, specs }: { name: string; imageUrl: string; specs?: ScooterSpecs | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return <>
    <button type="button" className="button yellow model-details-trigger" onClick={() => dialog.current?.showModal()}>
      Ver detalhes <Icon name="arrow" size={16} />
    </button>
    <dialog ref={dialog} className="model-dialog" aria-labelledby={title} onClick={(event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    }}>
      <div className="model-dialog-layout">
        <div className="model-dialog-media">
          {imageUrl ? <Image src={imageUrl} alt={name} fill sizes="(max-width: 760px) 90vw, 50vw" unoptimized /> : <Icon name="bolt" size={48} />}
          {specs?.colors && <p><strong>Cores</strong> {specs.colors}</p>}
        </div>
        <div className="model-dialog-content">
          <button type="button" className="model-dialog-close" aria-label="Fechar detalhes" onClick={() => dialog.current?.close()}>×</button>
          <p className="eyebrow">DETALHES DO MODELO</p>
          <h2 id={title}>{name}</h2>
          <dl>{scooterFields.filter(({ key }) => key !== "colors").map(({ key, label }) => (
            <div key={key}><dt>{label}</dt><dd>{specs?.[key] || <span>A confirmar</span>}</dd></div>
          ))}</dl>
          <a className="button yellow" href={instagram} target="_blank" rel="noreferrer">Quero fazer um test ride <Icon name="external" size={16} /></a>
          <p className="model-dialog-note">Converse com a equipe pelo Instagram para combinar o teste.</p>
        </div>
      </div>
    </dialog>
  </>;
}
