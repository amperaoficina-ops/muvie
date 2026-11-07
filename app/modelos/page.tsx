import Link from "next/link";
import { ModelCard, readCatalog, SiteFooter, SiteHeader } from "../catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos de scooters elétricas | MUVI-E" };

export default async function Models() {
  const { products } = await readCatalog();
  return <div className="site"><SiteHeader />
    <main className="site-wrap site-section models-page">
      <Link className="text-link" href="/">← Voltar ao início</Link>
      <div className="section-heading"><div><p className="eyebrow">CATÁLOGO MUVI-E</p><h1>Encontre seu modelo.</h1></div>
        <p>Conheça as scooters e consulte cores e disponibilidade com a equipe da sua unidade.</p>
      </div>
      <div className="catalog-grid">{products.map((product) => <ModelCard key={product.id} product={product} />)}</div>
    </main><SiteFooter />
  </div>;
}
