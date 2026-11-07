import { spawn } from "node:child_process";
import { localMongoConfig } from "../lib/mongo-config.ts";

if (localMongoConfig().dbName !== "muvie_demo") throw new Error("A demonstração só pode usar MONGODB_DB=muvie_demo.");
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3001"], {
  stdio: "inherit", env: { ...process.env, MUVIE_DEMO: "1" },
});
next.on("exit", (code) => { process.exitCode = code ?? 0; });
