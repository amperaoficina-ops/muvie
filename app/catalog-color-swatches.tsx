import { productColorHex, type ProductColor } from "@/domain/product-colors";

export function CatalogColorSwatches({ colors }: { colors: { color: ProductColor; available: boolean }[] }) {
  if (!colors.length) return null;
  return <ul className="catalog-colors" aria-label="Disponibilidade por cor">
    {colors.map(({ color, available }) => {
      const label = color + (available ? " · Em estoque" : " · Sem estoque");
      return <li key={color} className={available ? undefined : "catalog-color-unavailable"} title={label}>
        <span className="catalog-color-dot" aria-hidden="true" style={{ backgroundColor: productColorHex[color] }}>
          {!available && <span>×</span>}
        </span>
        <span className="sr-only">{label}</span>
      </li>;
    })}
  </ul>;
}
