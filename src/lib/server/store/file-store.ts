import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { compactAppStateForStorage } from "@/lib/shared/thread-persistence";
import { createSeedState } from "@/lib/server/store/seed";
import type { AppState } from "@/lib/shared/types";

const dataPath = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "mail-service-db.json");

let lock: Promise<void> = Promise.resolve();

async function ensureStateFile() {
  try {
    await readFile(dataPath, "utf8");
  } catch {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await writeFile(dataPath, JSON.stringify(createSeedState(), null, 2), "utf8");
  }
}

export async function readState(): Promise<AppState> {
  await ensureStateFile();
  const raw = await readFile(dataPath, "utf8");
  return JSON.parse(raw) as AppState;
}

export async function writeState(nextState: AppState) {
  await ensureStateFile();
  const compactedState = compactAppStateForStorage(nextState);
  await writeFile(dataPath, JSON.stringify(compactedState, null, 2), "utf8");
}

export async function mutateState<T>(mutator: (draft: AppState) => Promise<T> | T): Promise<T> {
  const operation = lock.then(async () => {
    const current = await readState();
    const result = await mutator(current);
    await writeState(current);
    return result;
  });

  lock = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}
