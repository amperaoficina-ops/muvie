import Link from "next/link";

export const instagram = "https://www.instagram.com/muvie_motoseletricas/";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link className="brand" href={href} aria-label="MUVI-E, início">
    <span className="brand-symbol" aria-hidden="true" />
    <span>MUVI<span className="brand-dash">-</span>E<small>MOBILIDADE ELÉTRICA</small></span>
  </Link>;
}

export function Icon({ name, size = 20 }: { name: "arrow" | "external" | "bolt" | "pin" | "grid" | "bag" | "box" | "users" | "menu"; size?: number }) {
  const paths = {
    arrow: "M3 12h17m-6-6 6 6-6 6",
    external: "M7 17 17 7M7 7h10v10",
    bolt: "m13 2-9 12h7l-1 8 10-12h-7l1-8z",
    pin: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z M12 8a2 2 0 1 0 0 4 2 2 0 1 0 0-4",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    bag: "M5 8h14l2 13H3L5 8zm4 1V6a3 3 0 0 1 6 0v3",
    box: "m12 3 9 5v8l-9 5-9-5V8l9-5zm-9 5 9 5 9-5m-9 5v8",
    users: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-4m-8-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-7a4 4 0 0 1 0 7",
    menu: "M4 6h16M4 12h16M4 18h16",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
