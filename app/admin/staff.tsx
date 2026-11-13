import { randomUUID } from "node:crypto";
import { businessDate, money, storeList, storeName, type RetailState } from "@/domain/retail";
import { saveStaffAdvance } from "./actions";
import { StoreItemForm } from "./finance";
import { Submit } from "./submit";

export function StaffPanel({ state, filter }: { state: RetailState; filter: string }) {
  const today = businessDate();
  const month = today.slice(0, 7);
  const staff = state.staff.filter((item) => !filter || item.store === filter);
  const sales = state.sales.filter((sale) => !sale.canceledAt && (!filter || sale.store === filter)
    && businessDate(new Date(sale.createdAt)).startsWith(month));
  const advances = state.staffAdvances ?? [];
  return <div className="sales-workspace">
    <section className="panel">
      <div className="panel-title"><h2>Equipe</h2><span className="pill">{month.split("-").reverse().join("/")}</span></div>
      <div className="table-wrap"><table>
        <thead><tr>{["Funcionário", "Unidade", "Fixo mensal", "Comissão", "Vendas do mês", "Vales do mês"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{staff.map((employee) => {
          const sold = sales.filter((sale) => sale.sellerId === employee.id);
          const records = advances.filter((item) => item.staffId === employee.id && (!filter || item.store === filter));
          const monthAdvances = records.filter((item) => item.date.startsWith(month));
          return <tr key={employee.id}>
            <td><details><summary><strong>{employee.name}</strong></summary>
              <StoreItemForm kind="staff" item={employee} store={employee.store} staffPage />
            </details><small>{employee.job}{employee.active ? "" : " · Inativo"}</small></td>
            <td>{storeName(employee.store, state)}</td><td>{money(employee.salary)}</td>
            <td>{(employee.commissionBps / 100).toLocaleString("pt-BR")}%<small>{money(sold.reduce((sum, sale) => sum + (sale.commission ?? 0), 0))} no mês</small></td>
            <td>{money(sold.reduce((sum, sale) => sum + sale.total, 0))}<small>{sold.length} venda(s)</small></td>
            <td>{money(monthAdvances.reduce((sum, item) => sum + item.amount, 0))}
              {records.length > 0 && <details><summary>Ver histórico</summary>
                <ul>{records.map((item) => <li key={item.id}>{item.date.split("-").reverse().join("/")} · {money(item.amount)}{item.notes && " · " + item.notes}</li>)}</ul>
              </details>}
            </td>
          </tr>;
        })}</tbody>
      </table></div>
      {!staff.length && <p className="admin-empty">Nenhum funcionário nesta seleção.</p>}
    </section>
    <section className="panel"><details className="editable-list"><summary>＋ Cadastrar funcionário</summary>
      <StoreItemForm kind="staff" store={filter} units={storeList(state)} staffPage />
    </details></section>
    <section className="panel">
      <div className="panel-title"><h2>Registrar vale</h2></div>
      {staff.some((item) => item.active) ? <form className="admin-form" action={saveStaffAdvance}>
        <input type="hidden" name="advanceId" value={randomUUID()} />
        <input type="hidden" name="filter" value={filter} />
        <label>Funcionário<select name="staffId" required defaultValue="">
          <option value="" disabled>Selecione</option>
          {staff.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {storeName(item.store, state)}</option>)}
        </select></label>
        <label>Valor (R$)<input name="amount" type="number" min=".01" max="99999999.99" step=".01" required /></label>
        <label>Data de emissão<input name="date" type="date" defaultValue={today} max={today} required /></label>
        <label>Observação<input name="notes" maxLength={300} /></label>
        <p className="form-note span-two">Registro interno de vales emitidos. O lançamento financeiro e o desconto em folha são feitos separadamente.</p>
        <div className="span-two"><Submit>Registrar vale</Submit></div>
      </form> : <p className="admin-empty">Cadastre um funcionário ativo para registrar um vale.</p>}
    </section>
  </div>;
}
