import Image from "next/image";
import Link from "next/link";
import { money, type Product } from "@/domain/retail";
import { readRetail } from "@/lib/retail-store";
import { Brand, Icon, instagram } from "./brand";
import { ModelDetails } from "./model-details";

export const exampleModel: Product = {
  id: "bravus-preview", sku: "DEMO-BRAVUS", name: "Bravus", category: "Scooter elétrica",
  description: "Uma scooter para conhecer de perto. Converse com a equipe sobre cores, disponibilidade e condições na sua unidade.",
  imageUrl: "/brand/bravus-branca.webp", price: 0, published: true, stock: { "sao-jose": 0, palhoca: 0 },
};

export async function readCatalog() {
  const state = await readRetail().catch(() => null);
  const products = state?.products.filter((item) => item.published && item.category === "Scooter elétrica") ?? [];
  return { products: products.length ? products : [exampleModel], testimonials: state?.testimonials ?? [] };
}

export function SiteHeader() {
  return <header className="site-header"><div className="site-wrap site-nav">
    <Brand />
    <nav aria-label="Navegação principal"><Link href="/modelos">Modelos</Link><Link href="/#lojas">Lojas</Link></nav>
    <a className="button outline" href={instagram} target="_blank" rel="noreferrer">Fale com a loja <Icon name="external" size={16} /></a>
  </div></header>;
}

export function SiteFooter() {
  return <footer className="site-footer site-wrap"><Brand /><p>Sua nova forma de rodar.</p><Link className="text-link" href="/modelos">Ver modelos <Icon name="arrow" size={16} /></Link></footer>;
}

export function ModelCard({ product }: { product: Product }) {
  const demo = product.id === exampleModel.id || product.sku.startsWith("DEMO-");
  return <article className="catalog-card">
    <div className="catalog-picture model-picture">
      {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 90vw, 33vw" unoptimized /> : <Icon name="bolt" size={36} />}
    </div>
    <div className="catalog-copy">
      <p className="eyebrow">{demo ? "MODELO DEMONSTRATIVO" : product.category}</p><h3>{product.name}</h3>
      {product.description && <p>{product.description}</p>}
      <strong>{product.price && !demo ? money(product.price) : "Preço sob consulta"}</strong>
      <ModelDetails name={product.name} imageUrl={product.imageUrl} specs={product.specs} />
    </div>
  </article>;
}
