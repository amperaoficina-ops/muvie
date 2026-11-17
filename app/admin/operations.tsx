import Link from "next/link";
import { CreateDialog, DetailsDialog } from "./sale-dialog";
import { SearchSelect } from "./search-select";
import { cardMachineOptions, legacyCardMachine, rateMachineId, type CardMachine, type CardRate, type RetailState } from "@/domain/retail";
import { manageCardMachine, saveCardMachine, saveRate, saveTestimonial, saveUser } from "./actions";
import { Submit } from "./submit";
import { isPrimaryAdmin, roles, type AccountAccess } from "@/domain/access";
import { AccessFields } from "./access-fields";

export function CardSettings({ state, machineId, error, canManage }: { state: RetailState; machineId?: string; error?: string; canManage: boolean }) {
  const machines = cardMachineOptions(state.cardMachines, state.cardRates);
  const selected = machines.find((item) => item.id === machineId) ?? machines[0];
  const rates = state.cardRates.filter((rate) => rateMachineId(rate) === selected?.id);
  return <>
    <CreateDialog id="nova-maquininha" title="Cadastrar maquininha" reopen={false}>
      <form action={saveCardMachine} className="admin-form">
        <label className="span-two">Nome<input name="name" required maxLength={70} placeholder="Ex.: Itaú, Rendimento ou InfinitePay" /></label>
        <div className="span-two"><Submit>Cadastrar maquininha</Submit></div>
      </form>
    </CreateDialog>
    {selected ? <>
      <nav className="stock-category-filter" aria-label="Filtrar taxas por maquininha">
        {machines.map((item) => <Link key={item.id} aria-current={item.id === selected.id ? "page" : undefined}
          href={"/admin?tab=taxas&maquininha=" + encodeURIComponent(item.id)}>{item.name}{item.inactive ? " · Inativa" : ""}</Link>)}
      </nav>
      <section className="panel">
        <div className="panel-title"><h2>{selected.name}{selected.inactive ? " · Inativa" : ""}</h2>
          <div className="workspace-section-links">
            <a className="button yellow" href="#nova-taxa">＋ Adicionar taxa</a>
            {canManage && <DetailsDialog key={selected.id} id={"maquininha-" + selected.id} title={selected.name} trigger="Editar">
              <form action={manageCardMachine} className="admin-form">
                <input type="hidden" name="machineId" value={selected.id} />
                <label className="span-two">Nome<input name="name" defaultValue={selected.name} required maxLength={70} /></label>
                <div className="span-two"><Submit>Salvar nome</Submit></div>
              </form>
              <form action={manageCardMachine} className="admin-form">
                <input type="hidden" name="machineId" value={selected.id} />
                <input type="hidden" name="operation" value={selected.inactive ? "enable" : "disable"} />
                <p className="form-note span-two">{selected.inactive ? "Reative para voltar a usar esta maquininha em vendas e simulações." : "Desative para suspender o uso em novas vendas e simulações."}</p>
                <div className="span-two"><Submit variant={selected.inactive ? "yellow" : "danger"}>
                  {selected.inactive ? "Reativar maquininha" : "Desativar maquininha"}
                </Submit></div>
              </form>
              {selected.id !== legacyCardMachine && <form action={manageCardMachine} className="admin-form">
                <input type="hidden" name="machineId" value={selected.id} /><input type="hidden" name="operation" value="delete" />
                <label className="checkbox span-two"><input type="checkbox" name="confirmed" required /> Confirmo a exclusão da maquininha e das taxas cadastradas nela.</label>
                <div className="span-two"><Submit variant="danger">Excluir maquininha</Submit></div>
              </form>}
            </DetailsDialog>}
          </div>
        </div>
        <CreateDialog id="nova-taxa" title={"Adicionar taxa · " + selected.name} reopen={false}>
          <RateForm machine={selected} machines={machines} />
        </CreateDialog>
        {rates.length ? <div className="table-wrap"><table>
          <thead><tr>{["Condição", "Modalidade", "Parcelas", "Taxa", "Ação"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{rates.map((rate) => <tr key={rate.id}>
            <td>{rate.name}</td><td>{rate.mode}</td><td>{rate.installments}×</td><td>{(rate.basisPoints / 100).toLocaleString("pt-BR")}%</td>
            <td><DetailsDialog id={"taxa-" + rate.id} title={rate.name} trigger="Editar taxa">
              <RateForm rate={rate} machine={selected} machines={machines} />
            </DetailsDialog></td>
          </tr>)}</tbody>
        </table></div> : <p className="admin-empty">Nenhuma taxa cadastrada nesta maquininha.</p>}
      </section>
    </> : <p className="admin-empty">{error || "Cadastre uma maquininha para adicionar as condições de cartão."}</p>}
  </>;
}

function RateForm({ rate, machine, machines }: { rate?: CardRate; machine: CardMachine; machines: CardMachine[] }) {
  return <form className="admin-form" action={saveRate}>
    <input type="hidden" name="id" value={rate?.id ?? ""} />
    {rate ? <label className="span-two">Maquininha<SearchSelect name="machineId" defaultValue={machine.id} required>
      {machines.filter((item) => item.id !== legacyCardMachine || machine.id === item.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </SearchSelect></label> : <input type="hidden" name="machineId" value={machine.id} />}
    <label className="span-two">Nome da condição<input name="name" defaultValue={rate?.name} maxLength={70} placeholder="Ex.: Visa em até 10×" required /></label>
    <label>Modalidade<SearchSelect name="mode" defaultValue={rate?.mode ?? "Crédito"}><option>Crédito</option><option>Débito</option></SearchSelect></label>
    <label>Parcelas<input name="installments" type="number" min="1" max="24" defaultValue={rate?.installments ?? 1} required /></label>
    <label>Taxa total (%)<input name="percent" inputMode="decimal" defaultValue={rate ? rate.basisPoints / 100 : ""} required /></label>
    <div className="span-two"><Submit>Salvar taxa</Submit></div>
  </form>;
}

export function TestimonialsSettings({ state }: { state: RetailState }) {
  return <div className="operation-grid">
    <section className="panel"><div className="panel-title"><h2>Relatos publicados</h2></div>
      {state.testimonials.length ? <div className="admin-form">{state.testimonials.map((item) => <div key={item.id} className="span-two">
        <p><strong>{item.author}</strong> · {item.quote}</p>
        <form action={saveTestimonial}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="remove" value="yes" /><button className="back-link">Retirar da landing</button></form>
      </div>)}</div> : <p className="admin-empty">Os relatos publicados por você aparecem na landing.</p>}
    </section>
    <section className="panel"><div className="panel-title"><h2>Publicar relato autorizado</h2></div>
      <form className="admin-form" action={saveTestimonial}>
        <label className="span-two">Nome de exibição<input name="author" maxLength={70} required /></label>
        <label className="span-two">Relato<textarea name="quote" rows={4} maxLength={320} required /></label>
        <div className="span-two"><Submit>Publicar na landing</Submit></div>
      </form>
    </section>
  </div>;
}

type TeamAccount = AccountAccess & { name: string; email: string; disabled?: boolean };

export function UsersPanel({ users, actor }: { users: TeamAccount[]; actor: TeamAccount }) {
  const primary = isPrimaryAdmin(actor);
  return <div className="operation-grid">
    <section className="panel"><div className="panel-title"><h2>Equipe da loja</h2></div>
      <div className="editable-list">{users.map((user) => {
        const protectedAccount = isPrimaryAdmin(user) || user.email === actor.email || (user.role === "admin" && !primary);
        return <details name="account" key={user.email}>
          <summary><span><strong>{user.name}</strong><small>{user.email} · {roles[user.role ?? "admin"]} · {user.disabled ? "Inativo" : "Ativo"}</small></span>
            <span className="pill">{protectedAccount ? "Protegido" : Array.isArray(user.permissions) ? "Personalizado" : "Padrão do cargo"}</span></summary>
          {protectedAccount ? <p className="admin-empty">O acesso desta conta fica protegido nesta sessão.</p> :
            <form className="admin-form" action={saveUser}>
              <input type="hidden" name="edit" value="yes" /><input type="hidden" name="email" value={user.email} />
              <label className="span-two">Nome<input name="name" required maxLength={100} defaultValue={user.name} /></label>
              <AccessFields account={user} allowAdmin={primary} />
              <label className="checkbox span-two"><input type="checkbox" name="active" defaultChecked={!user.disabled} /> Conta ativa</label>
              <div className="span-two"><Submit>Salvar acesso</Submit></div>
            </form>}
        </details>;
      })}</div>
    </section>
    <section className="panel"><div className="panel-title"><h2>Novo usuário</h2></div>
      <form className="admin-form" action={saveUser}>
        <label className="span-two">Nome<input name="name" required maxLength={100} /></label>
        <label className="span-two">E-mail<input name="email" type="email" required maxLength={254} /></label>
        <label className="span-two">Senha inicial<input name="password" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /></label>
        <AccessFields allowAdmin={primary} />
        <div className="span-two"><Submit>Criar acesso</Submit></div>
      </form>
    </section>
  </div>;
}
