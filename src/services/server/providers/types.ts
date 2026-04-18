import type {
  AccountProvider,
  ComposeMode,
  ConnectAccountPayload,
  ProviderDescriptor,
  StoredAccount,
  Thread,
} from "@/models";

export interface SyncInboxOptions {
  offset?: number;
  limit?: number;
}

export interface PreparedAccount {
  provider: AccountProvider;
  label: string;
  connectionSummary: string;
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
}

export interface SendMailInput {
  account: StoredAccount;
  mode: ComposeMode;
  originalThread?: Thread | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
}

export interface SendMailReceipt {
  accepted: string[];
  rejected: string[];
  providerMessageId?: string;
  deliverySummary: string;
}

export interface MailProviderDriver {
  descriptor: ProviderDescriptor;
  prepareAccount(input: ConnectAccountPayload): Promise<PreparedAccount>;
  syncInbox(account: StoredAccount, options?: SyncInboxOptions): Promise<Thread[]>;
  sendMail(input: SendMailInput): Promise<SendMailReceipt>;
}
