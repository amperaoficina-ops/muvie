import "server-only";
import { MongoClient } from "mongodb";
import { localMongoConfig } from "./mongo-config";

const cache = globalThis as typeof globalThis & { muvieMongo?: Promise<MongoClient> };

export async function getMongoDb() {
  const { uri, dbName } = localMongoConfig();
  cache.muvieMongo ??= new MongoClient(uri, {
    directConnection: true, maxPoolSize: 10, serverSelectionTimeoutMS: 1800,
  }).connect().catch((error) => {
    cache.muvieMongo = undefined;
    throw error;
  });
  return (await cache.muvieMongo).db(dbName);
}
