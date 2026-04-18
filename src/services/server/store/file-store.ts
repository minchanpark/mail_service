import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { compactAppStateForStorage, sortThreadsByReceivedAt } from "@/other/utils/thread-persistence";
import { createSeedState } from "@/services/server/store/seed";
import { migrateLegacyStateSecrets } from "@/services/server/store/secret-store";
import type { AppState } from "@/models";

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
    const migrated = await migrateLegacyStateSecrets(normalizedState);
    const finalState = migrated.state;
    const serialized = JSON.stringify(finalState, null, 2);
    await writeAtomically(backupPath, serialized);
    if (migrated.changed) {
      await writeAtomically(dataPath, serialized);
    }
    cachedState = finalState;
    return finalState;
  } catch (error) {
    const recoveredState = await readStateFromFile(backupPath);
    const normalizedState = {
      ...recoveredState,
      threads: sortThreadsByReceivedAt(recoveredState.threads),
    };
    const migrated = await migrateLegacyStateSecrets(normalizedState);
    const finalState = migrated.state;
    const serializedRecoveredState = JSON.stringify(finalState, null, 2);
    await writeAtomically(dataPath, serializedRecoveredState);
    await writeAtomically(backupPath, serializedRecoveredState);
    cachedState = finalState;
    console.warn("[mail-service] recovered state from backup after primary store read failed", error);
    return finalState;
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
