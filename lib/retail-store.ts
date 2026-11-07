import "server-only";
import { MongoServerError } from "mongodb";
import { emptyRetailState, RetailError, type RetailState } from "@/domain/retail";
import { getMongoDb } from "./mongodb";

type RetailDocument = { _id: "retail"; revision: number; state: RetailState };
const key = "retail";

function currentState(doc: RetailDocument | null): RetailState {
  if (!doc) return emptyRetailState();
  return { ...emptyRetailState(), ...doc.state };
}

async function collection() {
  return (await getMongoDb()).collection<RetailDocument>("app_state");
}

export async function readRetail() {
  const doc = await (await collection()).findOne({ _id: key });
  return currentState(doc);
}

export async function editRetail(edit: (state: RetailState) => void) {
  const rows = await collection();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const doc = await rows.findOne({ _id: key });
    const state = currentState(doc);
    edit(state);
    if (!doc) {
      try {
        await rows.insertOne({ _id: key, revision: 1, state });
        return;
      } catch (error) {
        if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      }
    } else {
      const result = await rows.updateOne({ _id: key, revision: doc.revision }, { $set: { state }, $inc: { revision: 1 } });
      if (result.modifiedCount) return;
    }
  }
  throw new RetailError("O cadastro mudou em outra operação. Tente novamente.");
}
