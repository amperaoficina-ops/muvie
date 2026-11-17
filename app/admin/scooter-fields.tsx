"use client";

import { useState, type ReactNode } from "react";
import { productCategories, type Product } from "@/domain/retail";
import { scooterCategory, scooterFields, type ScooterSpecs } from "@/domain/scooter";

function ScooterFields({ specs, purchase }: { specs?: ScooterSpecs | null; purchase?: boolean }) {
  return <fieldset className="scooter-fields span-two">
    <legend>Ficha técnica da scooter</legend>
    <p className="form-note span-two">{purchase
      ? "Os dados do produto vêm preenchidos. Os ajustes feitos aqui ficam no histórico desta compra."
      : "Preencha os dados confirmados do modelo. Os campos em branco aparecem como “A confirmar” no catálogo."}</p>
    {scooterFields.map(({ key, label, example }) => (
      <label key={key}>{label}<input name={`scooter-${key}`} defaultValue={specs?.[key]} placeholder={example} maxLength={120} /></label>
    ))}
  </fieldset>;
}

export function ProductCategoryFields({ product, children }: { product?: Pick<Product, "category" | "specs">; children: ReactNode }) {
  const [category, setCategory] = useState<string>(product?.category === "Bicicleta elétrica" ? "" : product?.category ?? "");
  return <>
    <label className="span-two">Categoria<select name="category" required value={category} onChange={(event) => setCategory(event.target.value)}>
      <option value="" disabled>Selecione a categoria</option>
      {productCategories.map((item) => <option key={item}>{item}</option>)}
    </select></label>
    {children}
    {category === scooterCategory && <ScooterFields specs={product?.specs} />}
  </>;
}

type PurchaseProduct = Pick<Product, "id" | "name" | "sku" | "category" | "specs">;

export function PurchaseProductFields({ products, initialId }: { products: PurchaseProduct[]; initialId?: string }) {
  const [id, setId] = useState(initialId ?? "");
  const product = products.find((item) => item.id === id);
  return <>
    <label>Produto<select name="productId" value={id} onChange={(event) => setId(event.target.value)} required>
      <option value="" disabled>Selecione um produto</option>
      {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
    </select></label>
    <label>Custo unitário da compra (R$)<input key={id} name="unitCost" inputMode="decimal" placeholder="0,00" required /></label>
    {product?.category === scooterCategory && <ScooterFields key={id} specs={product.specs} purchase />}
  </>;
}
