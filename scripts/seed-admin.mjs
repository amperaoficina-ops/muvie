import { MongoClient } from "mongodb";
import { hashPassword } from "../lib/security.ts";
import { localMongoConfig } from "../lib/mongo-config.ts";

const email = process.env.MUVIE_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.MUVIE_ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || password.length > 256) {
  throw new Error("Preencha MUVIE_ADMIN_EMAIL e MUVIE_ADMIN_PASSWORD (12 a 256 caracteres) no .env.local.");
}

const { uri, dbName } = localMongoConfig();
const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 3000 });
try {
  const db = client.db(dbName);
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const result = await db.collection("users").updateOne(
    { email },
    { $setOnInsert: { email, name: "Admin MUVI-E", passwordHash: hashPassword(password) } },
    { upsert: true },
  );
  console.log(result.upsertedCount ? "Administrador local criado." : "O administrador já existe. A senha foi preservada.");
} finally {
  await client.close();
}
