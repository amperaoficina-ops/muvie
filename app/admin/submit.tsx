"use client";

import { useFormStatus } from "react-dom";

export function Submit({ children, variant = "yellow" }: { children: React.ReactNode; variant?: "yellow" | "danger" }) {
  const { pending } = useFormStatus();
  return <button className={"button " + variant} type="submit" disabled={pending}>{pending ? "Salvando…" : children}</button>;
}
