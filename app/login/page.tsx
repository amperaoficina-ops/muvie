import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Brand, Icon } from "../brand";
import { signIn } from "./actions";

export const metadata = { title: "Entrar no painel" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/admin");
  const { erro } = await searchParams;
  return <main className="login-page">
    <div className="login-banner"><Brand /><div><p className="eyebrow">OPERAÇÃO DE LOJA</p><h1>O dia a dia<br />da <em>MUVI-E.</em></h1><p>São José · Palhoça</p></div></div>
    <div className="login-main"><div className="login-form">
      <Link className="back-link" href="/">← Voltar para a loja</Link>
      <p className="eyebrow">ACESSO DA EQUIPE</p><h2>Entrar no painel</h2><p>Use as credenciais do seu administrador local.</p>
      {erro && <p className="feedback error" role="alert">{erro === "banco" ? "O banco local está indisponível. Confira se o MongoDB está rodando." : "E-mail ou senha inválidos."}</p>}
      <form action={signIn}>
        <label>E-mail<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
        <button className="button yellow" type="submit">Entrar <Icon name="arrow" size={17} /></button>
      </form>
    </div></div>
  </main>;
}
