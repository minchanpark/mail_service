import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { compactAppStateForStorage, sortThreadsByReceivedAt } from "@/lib/shared/thread-persistence";
import { createSeedState } from "@/lib/server/store/seed";
import type { AppState } from "@/lib/shared/types";

const dataPath = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "mail-service-db.json");
const backupPath = `${dataPath}.bak`;

let lock: Promise<void> = Promise.resolve();
let cachedState: AppState | null = null;

async function writeAtomically(targetPath: string, contents: string) {
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents, "utf8");

  try {
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function readStateFromFile(targetPath: string) {
  const raw = await readFile(targetPath, "utf8");
  return JSON.parse(raw) as AppState;
}

async function ensureStateFile() {
  try {
    await readFile(dataPath, "utf8");
  } catch {
    await mkdir(path.dirname(dataPath), { recursive: true });
    const seededState = createSeedState();
    const serializedSeedState = JSON.stringify(seededState, null, 2);
    await writeAtomically(dataPath, serializedSeedState);
    await writeAtomically(backupPath, serializedSeedState);
    cachedState = seededState;
  }
}

async function loadStateFromDisk() {
  try {
    const parsedState = await readStateFromFile(dataPath);
    const normalizedState = {
      ...parsedState,
      threads: sortThreadsByReceivedAt(parsedState.threads),
    };
    await writeAtomically(backupPath, JSON.stringify(normalizedState, null, 2));
    cachedState = normalizedState;
    return normalizedState;
  } catch (error) {
    const recoveredState = await readStateFromFile(backupPath);
    const normalizedState = {
      ...recoveredState,
      threads: sortThreadsByReceivedAt(recoveredState.threads),
    };
    const serializedRecoveredState = JSON.stringify(normalizedState, null, 2);
    await writeAtomically(dataPath, serializedRecoveredState);
    cachedState = normalizedState;
    console.warn("[mail-service] recovered state from backup after primary store read failed", error);
    return normalizedState;
  }
}

export async function readState(): Promise<AppState> {
  await ensureStateFile();
  if (cachedState) {
    return cachedState;
  }

  return loadStateFromDisk();
}

export async function writeState(nextState: AppState) {
  await ensureStateFile();
  const compactedState = compactAppStateForStorage(nextState);
  const serializedState = JSON.stringify(compactedState, null, 2);
  await writeAtomically(dataPath, serializedState);
  await writeAtomically(backupPath, serializedState);
  cachedState = compactedState;
}

export async function mutateState<T>(mutator: (draft: AppState) => Promise<T> | T): Promise<T> {
  const operation = lock.then(async () => {
    const current = structuredClone(await readState());
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
