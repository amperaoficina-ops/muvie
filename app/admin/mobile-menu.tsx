"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../brand";

export function MobileMenu({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 851px)");
    const closeOnDesktop = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return <div className="mobile-admin-menu">
    <button type="button" aria-haspopup="dialog" aria-controls="admin-mobile-nav" onClick={() => dialog.current?.showModal()}>
      <Icon name="menu" size={22} /> Menu
    </button>
    <dialog ref={dialog} id="admin-mobile-nav" aria-label="Menu do painel" className="mobile-admin-drawer"
      onClick={(event) => {
        if (event.target === event.currentTarget || (event.target instanceof Element && event.target.closest("a[href]"))) {
          event.currentTarget.close();
        }
      }}>
      <div className="mobile-drawer-content">
        <button type="button" className="mobile-drawer-close" aria-label="Fechar menu" onClick={() => dialog.current?.close()}>×</button>
        {children}
      </div>
    </dialog>
  </div>;
}
