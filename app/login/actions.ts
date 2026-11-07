"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export async function signIn(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 256) redirect("/login?erro=credenciais");
  let authenticated = false;
  try {
    authenticated = await login(email, password);
  } catch (error) {
    console.error("Falha no login local", error instanceof Error ? error.name : "Erro");
    redirect("/login?erro=banco");
  }
  redirect(authenticated ? "/admin" : "/login?erro=credenciais");
}

export async function signOut() {
  await logout();
  redirect("/login");
}
