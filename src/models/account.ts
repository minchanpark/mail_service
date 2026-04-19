export type ProviderId = "gmail" | "outlook" | "naver" | "custom-imap";
export type AccountProvider = "gmail" | "outlook" | "naver" | "custom-imap";
export type AccountStatus = "active" | "reauth_needed" | "disconnected";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Account {
  id: string;
  userId: string;
  driverId: ProviderId;
  provider: AccountProvider;
  email: string;
  label: string;
  unreadCount: number;
  status: AccountStatus;
  connectedAt: string;
  lastSyncedAt?: string;
  connectionSummary?: string;
}

export interface StoredAccount extends Account {
  secrets?: Record<string, string>;
  secretRef?: string;
  settings?: Record<string, string>;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
}

export interface ProviderField {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "number";
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  description: string;
  authType: "demo" | "app-password" | "basic";
  provider: AccountProvider;
  fields: ProviderField[];
}

export interface ConnectAccountPayload {
  driverId: ProviderId;
  email: string;
  label?: string;
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
}
