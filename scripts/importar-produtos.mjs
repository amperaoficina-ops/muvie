import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { localMongoConfig } from "../lib/mongo-config.ts";
import { emptyRetailState } from "../domain/retail.ts";

const products = [
  {
    "name": "EVON Nexus",
    "category": "Scooter elétrica",
    "price": 999000,
    "description": "Planilha: Azul (1), Preta (1), Rosa (1), Verde (1). Total em 10x na planilha: R$ 10.890,00. Sem baú; 1 baú informado por unidade (confirmar inclusão).",
    "specs": {
      "colors": "Azul, Preta, Rosa, Verde"
    }
  },
  {
    "name": "ECOVIVA HE-15",
    "category": "Scooter elétrica",
    "price": 999000,
    "description": "Planilha: Verde (4). Total em 10x na planilha: R$ 10.990,00.",
    "specs": {
      "colors": "Verde"
    }
  },
  {
    "name": "ECOVIVA J8B",
    "category": "Scooter elétrica",
    "price": 499000,
    "description": "Planilha: Preta (1). Total em 10x na planilha: R$ 5.990,00. Negociável.",
    "specs": {
      "colors": "Preta"
    }
  },
  {
    "name": "ECOVIVA H80",
    "category": "Scooter elétrica",
    "price": 399000,
    "description": "Planilha: Preto (1). Negociável; preço parcelado não informado.",
    "specs": {
      "colors": "Preto"
    }
  },
  {
    "name": "ECOVIVA H85",
    "category": "Scooter elétrica",
    "price": 429000,
    "description": "Planilha: Preto (1). Negociável; mensagem menciona 10x sem segundo preço.",
    "specs": {
      "colors": "Preto"
    }
  },
  {
    "name": "SUDO Triciclo",
    "category": "Scooter elétrica",
    "price": 1199000,
    "description": "Planilha: Cinza (1). Total em 10x na planilha: R$ 12.800,00. Negociável; cor informada sem quantidade explícita (assumida 1).",
    "specs": {
      "colors": "Cinza"
    }
  },
  {
    "name": "ECOMOBI X13",
    "category": "Scooter elétrica",
    "price": 999000,
    "description": "Planilha: Preta (1), Vermelha (1), Azul (1), Branca (1), Cinza (1). Total em 10x na planilha: R$ 10.890,00. Negociável.",
    "specs": {
      "colors": "Preta, Vermelha, Azul, Branca, Cinza"
    }
  },
  {
    "name": "ECOMOBI Super",
    "category": "Scooter elétrica",
    "price": 790000,
    "description": "Planilha: Preta (1), Vermelha (1), Azul (1), Branca (2). Total em 10x na planilha: R$ 8.990,00.",
    "specs": {
      "colors": "Preta, Vermelha, Azul, Branca"
    }
  },
  {
    "name": "ONESPORT Bike X9",
    "category": "Bicicleta elétrica",
    "price": 899000,
    "description": "Planilha: Cinza (1). Total em 10x na planilha: R$ 9.990,00. Quantidade não explícita (assumida 1).",
    "specs": null
  },
  {
    "name": "YOYO V07",
    "category": "Scooter elétrica",
    "price": 799000,
    "description": "Planilha: Branca (2). Total em 10x na planilha: R$ 8.990,00. Black Friday.",
    "specs": {
      "colors": "Branca"
    }
  },
  {
    "name": "BAUSHIMA B10",
    "category": "Scooter elétrica",
    "price": 799000,
    "description": "Planilha: Branca (2), Vermelha (1). Total em 10x na planilha: R$ 8.990,00. Black Friday; sem baú.",
    "specs": {
      "colors": "Branca, Vermelha"
    }
  },
  {
    "name": "Capacete EVON",
    "category": "Acessório",
    "price": 49000,
    "description": "Total em 10x na planilha: R$ 599,00."
  },
  {
    "name": "Capacete Pro Tork",
    "category": "Acessório",
    "price": 9900,
    "description": "Total em 10x na planilha: R$ 129,00."
  },
  {
    "name": "Baú GS G",
    "category": "Acessório",
    "price": 49000,
    "description": "Total em 10x na planilha: R$ 599,00."
  },
  {
    "name": "Protetor de água para painel",
    "category": "Acessório",
    "price": 8900,
    "description": "Total em 10x na planilha: R$ 99,00."
  },
  {
    "name": "Suporte celular G",
    "category": "Acessório",
    "price": 6900,
    "description": "Total em 10x na planilha: R$ 89,00."
  }
];

const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => arg !== "--apply")) throw new Error("Use somente --apply para gravar.");
const apply = args.includes("--apply");
const { uri, dbName } = localMongoConfig();
const normalize = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 });

async function importProducts() {
  const collection = client.db(dbName).collection("app_state");
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = await collection.findOne({ _id: "retail" });
    const existing = doc?.state.products ?? [];
    const additions = [];
    const skipped = [];
    for (const product of products) {
      const sku = "PLAN-" + normalize(product.name);
      const name = normalize(product.name);
      if (existing.some((item) => item.sku?.toUpperCase() === sku || normalize(item.name) === name)) {
        skipped.push(product.name);
        continue;
      }
      additions.push({ ...product, id: randomUUID(), sku, imageUrl: "", purchaseCost: null, published: false,
        stock: { "sao-jose": 0, palhoca: 0 } });
    }

    if (apply && additions.length) {
      if (doc) {
        const result = await collection.updateOne({ _id: "retail", revision: doc.revision },
          { $push: { "state.products": { $each: additions } }, $inc: { revision: 1 } });
        if (!result.modifiedCount) continue;
      } else {
        try {
          await collection.insertOne({ _id: "retail", revision: 1, state: { ...emptyRetailState(), products: additions } });
        } catch (error) {
          if (error.code === 11000) continue;
          throw error;
        }
      }
    }

    console.log(`Banco: ${dbName} · ${apply ? "importação" : "prévia"}`);
    for (const item of additions) console.log(`+ ${item.name} · ${item.category} · ${item.price / 100} BRL`);
    for (const name of skipped) console.log(`= ${name} · cadastro existente preservado`);
    console.log(`${additions.length} ${apply ? "criados" : "a criar"} · ${skipped.length} existentes`);
    return;
  }
  throw new Error("O cadastro mudou durante a importação. Execute novamente.");
}

try {
  await importProducts();
} catch (error) {
  console.error(`Falha na importação (${error.name}). Confira a conexão e o acesso ao banco da Muvi-E.`);
  process.exitCode = 1;
} finally {
  await client.close();
}
