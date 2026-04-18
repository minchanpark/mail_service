import type {
  AccountProvider,
  ConnectAccountPayload,
  ProviderDescriptor,
  StoredAccount,
  Thread,
} from "@/lib/shared/types";

export interface PreparedAccount {
  provider: AccountProvider;
  label: string;
  connectionSummary: string;
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
}

export interface MailProviderDriver {
  descriptor: ProviderDescriptor;
  prepareAccount(input: ConnectAccountPayload): Promise<PreparedAccount>;
  syncInbox(account: StoredAccount): Promise<Thread[]>;
}
