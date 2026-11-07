"use client";

import { useState } from "react";
import { accessFor, moduleKeys, modules, roles, type AccountAccess, type Module, type Role } from "@/domain/access";

export function AccessFields({ account, allowAdmin }: { account?: AccountAccess; allowAdmin: boolean }) {
  const [role, setRole] = useState<Role>(account?.role ?? "sales");
  const [custom, setCustom] = useState(Array.isArray(account?.permissions));
  const [selected, setSelected] = useState<Module[]>(() => accessFor({ ...account, role, managed: true }));
  const defaults = accessFor({ role, managed: true });
  return <>
    <label>Cargo<select name="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
      {Object.entries(roles).filter(([id]) => allowAdmin || id !== "admin").map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select></label>
    <label>Permissões<select name="permissionMode" value={custom ? "custom" : "default"} onChange={(event) => {
      if (event.target.value === "custom") setSelected(defaults);
      setCustom(event.target.value === "custom");
    }}>
      <option value="default">Usar padrão do cargo</option><option value="custom">Personalizar módulos</option>
    </select></label>
    <fieldset className="address-fields span-two access-fields"><legend>Módulos permitidos</legend>
      {moduleKeys.filter((key) => key !== "usuarios" || role === "admin").map((key) => <label className="checkbox" key={key}>
        <input type="checkbox" name="permission" value={key} checked={(custom ? selected : defaults).includes(key)} disabled={!custom}
          onChange={(event) => setSelected((list) => event.target.checked ? [...list, key] : list.filter((item) => item !== key))} /> {modules[key]}
      </label>)}
    </fieldset>
    <p className="form-note span-two">Cada módulo libera a tela e suas operações. Para restringir um módulo do cargo, selecione “Personalizar módulos”.</p>
  </>;
}
