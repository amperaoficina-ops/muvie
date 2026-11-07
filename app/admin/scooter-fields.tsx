"use client";

import { useState } from "react";
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

export function ProductCategoryFields({ product }: { product?: Pick<Product, "category" | "specs"> }) {
  const [category, setCategory] = useState<string>(product?.category ?? scooterCategory);
  return <>
    <label>Categoria<select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
      {productCategories.map((item) => <option key={item}>{item}</option>)}
    </select></label>
    {category === scooterCategory && <ScooterFields specs={product?.specs} />}
  </>;
}

type PurchaseProduct = Pick<Product, "id" | "name" | "sku" | "category" | "specs" | "purchaseCost">;

export function PurchaseProductFields({ products, initialId }: { products: PurchaseProduct[]; initialId?: string }) {
  const [id, setId] = useState(initialId ?? "");
  const product = products.find((item) => item.id === id);
  return <>
    <label>Produto<select name="productId" value={id} onChange={(event) => setId(event.target.value)} required>
      <option value="" disabled>Selecione um produto</option>
      {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
    </select></label>
    <label>Custo unitário da compra (R$)<input key={id} name="unitCost" type="number" min=".01" max="99999999.99" step=".01"
      defaultValue={product?.purchaseCost != null ? product.purchaseCost / 100 : ""} required /></label>
    {product?.category === scooterCategory && <ScooterFields key={id} specs={product.specs} purchase />}
  </>;
}
