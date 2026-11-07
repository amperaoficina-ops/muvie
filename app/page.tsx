import Image from "next/image";
import Link from "next/link";
import { stores } from "@/domain/retail";
import { Icon, instagram } from "./brand";
import { ModelCard, readCatalog, SiteFooter, SiteHeader } from "./catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { products, testimonials } = await readCatalog();
  return <div className="site">
    <SiteHeader />
    <main>
      <section className="site-wrap hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> SCOOTERS ELÉTRICAS <span className="dot-divider">/</span> SC</p>
          <h1>Sua nova<br />forma de <em>rodar.</em></h1>
          <p className="hero-description">Descubra scooters elétricas para o seu dia a dia. Conheça a MUVI-E em São José e Palhoça.</p>
          <div className="hero-actions"><Link className="button yellow" href="/modelos">Explorar modelos <Icon name="arrow" size={18} /></Link><a className="text-link" href="#lojas">Ver lojas <Icon name="external" size={16} /></a></div>
        </div>
        <figure className="hero-photo">
          <Image src="/brand/fachada-muvi-e.webp" alt="Fachada da MUVI-E com scooters em exposição" width={1536} height={1024} sizes="(max-width: 760px) 95vw, 56vw" preload />
          <figcaption><span><Icon name="pin" size={15} /> GRANDE FLORIANÓPOLIS, SC</span><span>MUVI-E / LOJAS</span></figcaption>
        </figure>
      </section>
      <div className="signal-bar"><div className="site-wrap"><span><Icon name="bolt" size={19} /> Mobilidade elétrica</span><span><Icon name="pin" size={19} /> São José</span><span><Icon name="pin" size={19} /> Palhoça</span></div></div>
      <section id="modelos" className="site-wrap site-section">
        <div className="section-heading"><div><p className="eyebrow">01 / CATÁLOGO</p><h2>Encontre sua próxima scooter.</h2></div><p>Veja os modelos cadastrados e fale com a equipe para confirmar a disponibilidade na sua loja.</p></div>
        <div className="catalog-grid">{products.slice(0, 3).map((product) => <ModelCard key={product.id} product={product} />)}</div>
        <Link className="button outline catalog-more" href="/modelos">Ver todos os modelos <Icon name="arrow" size={17} /></Link>
      </section>
      <section className="site-wrap site-section customer-stories" id="relatos">
        <div className="section-heading"><div><p className="eyebrow">QUEM JÁ ESCOLHEU A MUVI-E</p><h2>Relatos de clientes.</h2></div>
          <a className="button outline" href="https://muviemotoseletricas.online/#avaliacoes" target="_blank" rel="noreferrer">Ver avaliações da loja <Icon name="external" size={16} /></a>
        </div>
        {testimonials.length > 0 && <div className="catalog-grid">{testimonials.map((item) => <figure className="story-card" key={item.id}><blockquote>{item.quote}</blockquote><figcaption>{item.author}</figcaption></figure>)}</div>}
      </section>
      <section id="lojas" className="stores-band">
        <div className="site-wrap site-section">
          <div className="section-heading"><div><p className="eyebrow">02 / LOJAS</p><h2>Duas lojas. Perto de você.</h2></div><p>Escolha a unidade e fale com a equipe para confirmar endereço e horário de atendimento.</p></div>
          <div className="stores-grid">{stores.map((store, index) => <article className="store-card" key={store.id}>
            <span className="store-number">0{index + 1} / {store.code}</span><Icon name="pin" size={25} /><h3>{store.name}</h3><p>Santa Catarina</p>
            <a className="text-link" href={instagram} target="_blank" rel="noreferrer">Falar com a MUVI-E <Icon name="external" size={16} /></a>
          </article>)}</div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
