export function localMongoConfig() {
  const uri = process.env.MONGODB_URI?.trim() || "mongodb://127.0.0.1:27017";
  const dbName = process.env.MONGODB_DB?.trim() || "muvie_local";
  // Refuse remote hosts, seed lists and replica-set discovery in this local checkout.
  if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?\/?$/.test(uri) ||
    !/^muvie_[a-z0-9_]+$/.test(dbName)) {
    throw new Error("Use um MongoDB em localhost e um banco com prefixo muvie_.");
  }
  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  if (user || password) {
    if (!user || !password) throw new Error("Configure usuário e senha do MongoDB juntos.");
    const host = uri.slice("mongodb://".length).replace(/\/$/, "");
    return { uri: `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${dbName}?authSource=${dbName}`, dbName };
  }
  return { uri, dbName };
}
