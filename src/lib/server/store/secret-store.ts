import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { AppState, StoredAccount } from "@/lib/shared/types";

const execFileAsync = promisify(execFile);
const keychainServiceName = process.env.MAIL_SERVICE_KEYCHAIN_SERVICE?.trim() || "mail_service.accounts";
const insecureSecretsPath = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "mail-service-secrets.json");

type StoredSecrets = Record<string, string>;
type SecretStoreRecord = Record<string, StoredSecrets>;

function supportsMacKeychain() {
  return process.platform === "darwin";
}

function allowInsecureFileSecrets() {
  return process.env.MAIL_SERVICE_ALLOW_INSECURE_FILE_SECRETS === "true";
}

function keychainRef(accountId: string) {
  return `keychain:${accountId}`;
}

function fileRef(accountId: string) {
  return `file:${accountId}`;
}

async function readInsecureSecretFile() {
  try {
    const raw = await readFile(insecureSecretsPath, "utf8");
    return JSON.parse(raw) as SecretStoreRecord;
  } catch {
    return {};
  }
}

async function writeInsecureSecretFile(records: SecretStoreRecord) {
  await mkdir(path.dirname(insecureSecretsPath), { recursive: true });
  await writeFile(insecureSecretsPath, JSON.stringify(records, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function saveToKeychain(accountId: string, secrets: StoredSecrets) {
  await execFileAsync("security", [
    "add-generic-password",
    "-U",
    "-a",
    accountId,
    "-s",
    keychainServiceName,
    "-w",
    JSON.stringify(secrets),
  ]);
  return keychainRef(accountId);
}

async function readFromKeychain(accountId: string) {
  const { stdout } = await execFileAsync("security", [
    "find-generic-password",
    "-a",
    accountId,
    "-s",
    keychainServiceName,
    "-w",
  ]);
  return JSON.parse(stdout.trim()) as StoredSecrets;
}

async function deleteFromKeychain(accountId: string) {
  try {
    await execFileAsync("security", [
      "delete-generic-password",
      "-a",
      accountId,
      "-s",
      keychainServiceName,
    ]);
  } catch {
    // Ignore missing items during cleanup/migration.
  }
}

async function saveToInsecureFile(accountId: string, secrets: StoredSecrets) {
  const records = await readInsecureSecretFile();
  records[accountId] = secrets;
  await writeInsecureSecretFile(records);
  return fileRef(accountId);
}

async function readFromInsecureFile(accountId: string) {
  const records = await readInsecureSecretFile();
  return records[accountId];
}

async function deleteFromInsecureFile(accountId: string) {
  const records = await readInsecureSecretFile();
  if (!records[accountId]) {
    return;
  }

  delete records[accountId];
  await writeInsecureSecretFile(records);
}

function parseSecretRef(secretRef: string | undefined) {
  if (!secretRef) {
    return null;
  }

  const separatorIndex = secretRef.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  return {
    type: secretRef.slice(0, separatorIndex),
    accountId: secretRef.slice(separatorIndex + 1),
  };
}

export async function storeAccountSecrets(accountId: string, secrets: StoredSecrets | undefined) {
  if (!secrets || Object.keys(secrets).length === 0) {
    return undefined;
  }

  if (supportsMacKeychain()) {
    return saveToKeychain(accountId, secrets);
  }

  if (allowInsecureFileSecrets()) {
    return saveToInsecureFile(accountId, secrets);
  }

  throw new Error(
    "이 환경에서는 안전한 credential 저장소를 찾을 수 없습니다. macOS Keychain을 사용하거나 MAIL_SERVICE_ALLOW_INSECURE_FILE_SECRETS=true 를 명시적으로 설정해 주세요.",
  );
}

export async function loadAccountSecrets(account: Pick<StoredAccount, "secretRef" | "secrets">) {
  if (account.secrets && Object.keys(account.secrets).length > 0) {
    return account.secrets;
  }

  const parsed = parseSecretRef(account.secretRef);
  if (!parsed) {
    return undefined;
  }

  if (parsed.type === "keychain") {
    return readFromKeychain(parsed.accountId);
  }

  if (parsed.type === "file") {
    return readFromInsecureFile(parsed.accountId);
  }

  throw new Error(`지원하지 않는 secret reference입니다: ${account.secretRef}`);
}

export async function deleteAccountSecrets(secretRef: string | undefined) {
  const parsed = parseSecretRef(secretRef);
  if (!parsed) {
    return;
  }

  if (parsed.type === "keychain") {
    await deleteFromKeychain(parsed.accountId);
    return;
  }

  if (parsed.type === "file") {
    await deleteFromInsecureFile(parsed.accountId);
  }
}

export async function migrateLegacyStateSecrets(state: AppState) {
  let changed = false;

  const accounts = await Promise.all(
    state.accounts.map(async (account) => {
      if (!account.secrets || Object.keys(account.secrets).length === 0 || account.secretRef) {
        return account;
      }

      const secretRef = await storeAccountSecrets(account.id, account.secrets);
      changed = true;
      const { secrets: _legacySecrets, ...rest } = account;
      return {
        ...rest,
        secretRef,
      };
    }),
  );

  return {
    changed,
    state: {
      ...state,
      accounts,
    },
  };
}
