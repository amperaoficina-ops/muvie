"use client";

import { Children, isValidElement, useId, useRef, useState, type ReactNode } from "react";

type Option = { value?: string; disabled?: boolean; children?: ReactNode };
type Props = {
  children: ReactNode; name?: string; required?: boolean; value?: string; defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
};

export function SearchSelect({ children, name, required, value, defaultValue, onChange }: Props) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<Option>(child) || child.type !== "option") return [];
    const label = Children.toArray(child.props.children).join("");
    return [{ value: child.props.value ?? label, label, disabled: child.props.disabled }];
  });
  const [selected, setSelected] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? selected;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const matches = options.filter((option) => !option.disabled && normalize(option.label).includes(normalize(query.trim())));

  function close() { setOpen(false); setQuery(""); }
  return <span className="search-select" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className="search-select-trigger" aria-expanded={open} aria-controls={id}
      onClick={() => open ? close() : setOpen(true)}>
      <span>{options.find((option) => option.value === current)?.label || "Selecione"}</span><span aria-hidden="true">⌄</span>
    </button>
    <select className="search-select-value" tabIndex={-1} aria-hidden="true" name={name} required={required} value={current}
      onChange={() => {}} onInvalid={(event) => { event.preventDefault(); trigger.current?.focus(); setOpen(true); }}>
      {!options.some((option) => option.value === "") && <option value="" />}
      {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    {open && <span className="search-select-menu" id={id}>
      <input autoFocus type="search" aria-label="Pesquisar opções" placeholder="Pesquisar…" value={query}
        onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
          if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.nextElementSibling?.querySelector("button")?.focus(); }
        }} />
      <span className="search-select-options" aria-label="Opções">
        {matches.map((option) => <button type="button" key={option.value} aria-pressed={current === option.value}
          onClick={() => { setSelected(option.value); onChange?.({ target: { value: option.value } }); close(); trigger.current?.focus(); }}>{option.label}</button>)}
        {!matches.length && <span className="search-select-empty">Nenhuma opção encontrada.</span>}
      </span>
    </span>}
  </span>;
}
