"use client";

import { useId, useState } from "react";

export function AttachmentPicker({ name, label, accept, hint, required }: {
  name: string;
  label: string;
  accept: string;
  hint: string;
  required?: boolean;
}) {
  const hintId = useId();
  const [filename, setFilename] = useState("");

  return <div className="attachment-picker">
    <label className="attachment-trigger">
      <input type="file" name={name} accept={accept} required={required} aria-describedby={hintId}
        onChange={(event) => setFilename(event.currentTarget.files?.[0]?.name ?? "")} />
      <span>
        <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15V3m-5 5 5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
        </svg>
        {filename ? "Trocar arquivo" : label}
      </span>
    </label>
    {filename && <span className="attachment-filename" role="status">{filename}</span>}
    <small id={hintId}>{hint}</small>
  </div>;
}
