import Image from "next/image";
import Link from "next/link";
import { money, stores, productColorAvailability, type Product } from "@/domain/retail";
import { readRetail } from "@/lib/retail-store";
import { Brand, Icon, instagram } from "./brand";
import { ModelDetails } from "./model-details";

export async function readCatalog() {
  const state = await readRetail().catch(() => null);
  const products = state?.products.filter((item) => item.published && ["Scooter elétrica", "Bicicleta elétrica"].includes(item.category)) ?? [];
  return { products: products.map((product) => ({ ...product, publicColors: productColorAvailability(product, state?.stockLots ?? []) })), testimonials: state?.testimonials ?? [] };
}

export function SiteHeader() {
  return <header className="site-header"><div className="site-wrap site-nav">
    <Brand />
    <nav aria-label="Navegação principal"><Link href="/modelos">Modelos</Link><Link href="/#lojas">Lojas</Link></nav>
    <a className="button outline" href={instagram} target="_blank" rel="noreferrer">Fale com a loja <Icon name="external" size={16} /></a>
  </div></header>;
}

export function SiteFooter() {
  const cnpj = process.env.MUVIE_PUBLIC_CNPJ;
  const email = process.env.MUVIE_PUBLIC_EMAIL;
  const whatsapp = process.env.MUVIE_PUBLIC_WHATSAPP?.replace(/\D/g, "");
  return <footer className="public-footer">
    <div className="site-wrap">
      <div className="public-footer-grid">
        <div><Brand /><p>Scooters elétricas na Grande Florianópolis.</p></div>
        <nav aria-label="Links do rodapé"><h2>Explore</h2>
          <Link href="/modelos">Modelos</Link><Link href="/#relatos">Avaliações</Link><Link href="/#lojas">Nossas lojas</Link>
        </nav>
        <div><h2>Contato e redes sociais</h2>
          <a href={instagram} target="_blank" rel="noreferrer">Instagram <Icon name="external" size={15} /></a>
          {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp <Icon name="external" size={15} /></a>}
          {email && <a href={`mailto:${email}`}>{email}</a>}
        </div>
        <div><h2>Localização</h2>
          {stores.map((store) => <a key={store.id} target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("MUVI-E " + store.name + " SC")}`}>
            <Icon name="pin" size={16} /> {store.name}, SC <Icon name="external" size={14} />
          </a>)}
        </div>
      </div>
      <div className="public-footer-legal"><span>© {new Date().getFullYear()} MUVI-E</span>{cnpj && <span>CNPJ {cnpj}</span>}</div>
    </div>
  </footer>;
}

export function CatalogEmpty() {
  return <div className="catalog-empty">
    <Icon name="bolt" size={25} />
    <h3>Nenhum modelo publicado no momento</h3>
    <p>Fale com a equipe para consultar os modelos disponíveis nas lojas.</p>
    <a className="button yellow" href={instagram} target="_blank" rel="noreferrer">Falar pelo Instagram <Icon name="external" size={16} /></a>
  </div>;
}

export function ModelCard({ product, colors = [] }: { product: Product; colors?: ReturnType<typeof productColorAvailability> }) {
  const demo = product.sku.startsWith("DEMO-");
  return <article className="catalog-card">
    <div className="catalog-picture model-picture">
      {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 90vw, 33vw" unoptimized /> : <Icon name="bolt" size={36} />}
    </div>
    <div className="catalog-copy">
      <p className="eyebrow">{demo ? "MODELO DEMONSTRATIVO" : product.category}</p><h3>{product.name}</h3>
      {product.description && <p>{product.description}</p>}
      <strong>{product.price && !demo ? money(product.price) : "Preço sob consulta"}</strong>
      {colors.length > 0 && <ul className="catalog-colors" aria-label="Disponibilidade por cor">
        {colors.map(({ color, available }) => <li key={color}>{color} <small>{available ? "Em estoque" : "Sem estoque"}</small></li>)}
      </ul>}
      <ModelDetails name={product.name} imageUrl={product.imageUrl} specs={product.specs} colors={colors} />
    </div>
  </article>;
}
