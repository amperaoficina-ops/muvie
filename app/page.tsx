import Image from "next/image";
import Link from "next/link";
import { stores } from "@/domain/retail";
import { Icon } from "./brand";
import { CatalogEmpty, ModelCard, readCatalog, SiteFooter, SiteHeader, storeMapUrl } from "./catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { products, testimonials } = await readCatalog();
  return <div className="site landing-page">
    <a className="landing-skip" href="#conteudo">Pular para o conteúdo</a>
    <SiteHeader landing />
    <main id="conteudo">
      <section className="site-wrap hero">
        <div className="hero-copy">
          <p className="eyebrow">São José e Palhoça, SC</p>
          <h1>Scooters <em>elétricas</em> para o dia a dia</h1>
          <p className="hero-description">Compare os modelos da MUVI-E e consulte a disponibilidade na loja mais perto de você.</p>
          <div className="hero-actions"><a className="button yellow" href="#modelos">Ver modelos <Icon name="arrow" size={18} /></a><a className="button outline" href="#lojas">Encontrar uma loja <Icon name="pin" size={17} /></a></div>
        </div>
        <figure className="hero-photo">
          <Image src="/brand/fachada-muvi-e.webp" alt="Fachada da MUVI-E com scooters em exposição" width={1536} height={1024} sizes="(max-width: 760px) 95vw, 56vw" preload />
        </figure>
      </section>
      <section id="modelos" className="site-wrap site-section">
        <div className="section-heading"><h2>Modelos de scooters</h2></div>
        {products.length ? <>
          <div className="catalog-grid">{products.slice(0, 3).map((product) => <ModelCard key={product.id} product={product} colors={product.publicColors} />)}</div>
          <Link className="button outline catalog-more" href="/modelos">Ver todos os modelos <Icon name="arrow" size={17} /></Link>
        </> : <CatalogEmpty />}
      </section>
      <section className="site-wrap site-section customer-stories" id="relatos">
        <div className="section-heading"><h2>Avaliações de clientes</h2>
          <a className="button outline" href="https://muviemotoseletricas.online/#avaliacoes" target="_blank" rel="noreferrer">Ver avaliações da loja <Icon name="external" size={16} /></a>
        </div>
        {testimonials.length > 0 && <div className="catalog-grid">{testimonials.map((item) => <figure className="story-card" key={item.id}><blockquote>{item.quote}</blockquote><figcaption>{item.author}</figcaption></figure>)}</div>}
      </section>
      <section id="lojas" className="stores-band">
        <div className="site-wrap site-section">
          <div className="section-heading"><h2>Nossas lojas</h2></div>
          <div className="stores-grid">{stores.map((store) => <article className="store-card" key={store.id}>
            <Icon name="pin" size={25} /><h3>{store.name}</h3><p>Santa Catarina</p>
            <a className="button outline" href={storeMapUrl(store.name)} target="_blank" rel="noreferrer" aria-label={`Ver MUVI-E em ${store.name} no mapa`}>Ver no mapa <Icon name="external" size={16} /></a>
          </article>)}</div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
