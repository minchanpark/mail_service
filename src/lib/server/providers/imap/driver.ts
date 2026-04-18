import dns from "node:dns/promises";
import net, { BlockList } from "node:net";
import { randomUUID } from "node:crypto";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

import {
  classifyThread,
  generateSummary,
  shouldMarkAction,
} from "@/lib/server/services/ai-service";
import { buildThreadId, formatAttachmentSize } from "@/lib/server/providers/helpers";
import { compactThreadForStorage } from "@/lib/shared/thread-persistence";
import type {
  MailProviderDriver,
  PreparedAccount,
  SendMailInput,
  SendMailReceipt,
  SyncInboxOptions,
} from "@/lib/server/providers/types";
import type {
  AccountProvider,
  ConnectAccountPayload,
  ProviderId,
  StoredAccount,
  Thread,
} from "@/lib/shared/types";

type ImapPreset = {
  provider: AccountProvider;
  label: string;
  description: string;
  host?: string;
  port?: number;
  secure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  authType: "app-password" | "basic";
};

type ErrorContext = "imap-connect" | "imap-sync" | "smtp-send";

type AddressEntry = {
  address?: string | null;
};

type AddressLike =
  | {
      value?: AddressEntry[];
    }
  | Array<{
      value?: AddressEntry[];
    }>;

const PRESETS: Record<Exclude<ProviderId, "mock">, ImapPreset> = {
  gmail: {
    provider: "gmail",
    label: "Gmail",
    description: "Gmail IMAP/SMTP 계정을 앱 비밀번호로 연결합니다.",
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    authType: "app-password",
  },
  outlook: {
    provider: "outlook",
    label: "Outlook",
    description: "Microsoft 365 / Outlook.com IMAP/SMTP 계정을 연결합니다.",
    host: "outlook.office365.com",
    port: 993,
    secure: true,
    smtpHost: "smtp-mail.outlook.com",
    smtpPort: 587,
    smtpSecure: false,
    authType: "basic",
  },
  naver: {
    provider: "naver",
    label: "Naver",
    description: "Naver IMAP/SMTP 계정을 연결합니다. PC 메일 설정에서 IMAP/SMTP 사용함, 2단계 인증, 애플리케이션 비밀번호가 필요합니다.",
    host: "imap.naver.com",
    port: 993,
    secure: true,
    smtpHost: "smtp.naver.com",
    smtpPort: 587,
    smtpSecure: false,
    authType: "app-password",
  },
  "custom-imap": {
    provider: "custom-imap",
    label: "Custom IMAP",
    description: "임의의 IMAP/SMTP 서버를 직접 입력해 연결합니다.",
    authType: "basic",
  },
};

const IMAP_FETCH_BATCH_SIZE = 50;
const DEFAULT_IMAP_SYNC_LIMIT = 25;
const privateAddressBlockList = new BlockList();

privateAddressBlockList.addSubnet("0.0.0.0", 8, "ipv4");
privateAddressBlockList.addSubnet("10.0.0.0", 8, "ipv4");
privateAddressBlockList.addSubnet("100.64.0.0", 10, "ipv4");
privateAddressBlockList.addSubnet("127.0.0.0", 8, "ipv4");
privateAddressBlockList.addSubnet("169.254.0.0", 16, "ipv4");
privateAddressBlockList.addSubnet("172.16.0.0", 12, "ipv4");
privateAddressBlockList.addSubnet("192.168.0.0", 16, "ipv4");
privateAddressBlockList.addSubnet("198.18.0.0", 15, "ipv4");
privateAddressBlockList.addSubnet("224.0.0.0", 4, "ipv4");
privateAddressBlockList.addSubnet("::", 128, "ipv6");
privateAddressBlockList.addSubnet("::1", 128, "ipv6");
privateAddressBlockList.addSubnet("fc00::", 7, "ipv6");
privateAddressBlockList.addSubnet("fe80::", 10, "ipv6");
privateAddressBlockList.addSubnet("ff00::", 8, "ipv6");
privateAddressBlockList.addSubnet("2001:db8::", 32, "ipv6");

function requireValue(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} 값이 필요합니다.`);
  }
  return normalized;
}

function normalizeHost(value: string, label: string) {
  const normalized = requireValue(value, label).toLowerCase().replace(/\.+$/, "");
  if (!normalized) {
    throw new Error(`${label} 값이 필요합니다.`);
  }

  return normalized;
}

function parsePort(value: string | undefined, label: string) {
  const normalized = requireValue(value, label);
  const port = Number.parseInt(normalized, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} 값이 올바르지 않습니다.`);
  }

  return String(port);
}

function parseBooleanFlag(value: string | undefined, label: string, fallback: "true" | "false") {
  const normalized = value?.trim().toLowerCase() || fallback;
  if (!["true", "false"].includes(normalized)) {
    throw new Error(`${label} 값은 true 또는 false 여야 합니다.`);
  }

  return normalized as "true" | "false";
}

function allowPrivateMailHosts() {
  return process.env.MAIL_SERVICE_ALLOW_PRIVATE_MAIL_HOSTS === "true";
}

function isBlockedAddress(address: string, family: 4 | 6) {
  return privateAddressBlockList.check(address, family === 6 ? "ipv6" : "ipv4");
}

async function assertSafeRemoteHost(host: string, label: string) {
  if (allowPrivateMailHosts()) {
    return;
  }

  const normalizedHost = normalizeHost(host, label);
  if (normalizedHost === "localhost" || normalizedHost.endsWith(".local")) {
    throw new Error(`${label}에는 localhost 또는 사설 네트워크 호스트를 사용할 수 없습니다.`);
  }

  const literalFamily = net.isIP(normalizedHost);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isBlockedAddress(normalizedHost, literalFamily)) {
      throw new Error(`${label}에는 공용으로 라우팅 가능한 메일 서버만 사용할 수 있습니다.`);
    }
    return;
  }

  const resolved = await dns.lookup(normalizedHost, {
    all: true,
    verbatim: true,
  });

  if (resolved.length === 0) {
    throw new Error(`${label}를 해석할 수 없습니다.`);
  }

  for (const entry of resolved) {
    if (isBlockedAddress(entry.address, entry.family as 4 | 6)) {
      throw new Error(`${label}에는 공용으로 라우팅 가능한 메일 서버만 사용할 수 있습니다.`);
    }
  }
}

async function assertCustomMailAccountSafety(account: StoredAccount) {
  if (account.driverId !== "custom-imap") {
    return;
  }

  await assertSafeRemoteHost(account.settings?.imapHost ?? "", "IMAP Host");
  await assertSafeRemoteHost(account.settings?.smtpHost ?? "", "SMTP Host");
}

function resolveAccountConfig(account: StoredAccount) {
  const preset = PRESETS[account.driverId as Exclude<ProviderId, "mock">];
  const host = account.settings?.imapHost ?? preset.host;
  const secureRaw = account.settings?.imapSecure;
  const secure = secureRaw ? secureRaw === "true" : preset.secure ?? true;
  const port = Number(account.settings?.imapPort ?? preset.port ?? 993);
  const password = requireValue(account.secrets?.password, "비밀번호");

  return {
    host: requireValue(host, "IMAP 호스트"),
    port,
    secure,
    auth: {
      user: account.email,
      pass: password,
    },
  };
}

function resolveSmtpConfig(account: StoredAccount) {
  const preset = PRESETS[account.driverId as Exclude<ProviderId, "mock">];
  const host = account.settings?.smtpHost ?? preset.smtpHost;
  const secureRaw = account.settings?.smtpSecure;
  const secure = secureRaw ? secureRaw === "true" : preset.smtpSecure ?? true;
  const port = Number(account.settings?.smtpPort ?? preset.smtpPort ?? (secure ? 465 : 587));
  const password = requireValue(account.secrets?.password, "비밀번호");

  return {
    host: requireValue(host, "SMTP 호스트"),
    port,
    secure,
    auth: {
      user: account.email,
      pass: password,
    },
  };
}

function readErrorText(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  return [
    error.message,
    String((error as { response?: unknown }).response ?? ""),
    String((error as { responseText?: unknown }).responseText ?? ""),
    String((error as { code?: unknown }).code ?? ""),
  ]
    .join(" ")
    .trim();
}

function mapImapProviderError(providerId: Exclude<ProviderId, "mock">, error: unknown, context: ErrorContext) {
  if (!(error instanceof Error)) {
    return new Error("메일 서버 연결에 실패했습니다.");
  }

  const lowerText = readErrorText(error).toLowerCase();
  const isAuthFailure =
    Boolean((error as { authenticationFailed?: boolean }).authenticationFailed) ||
    lowerText.includes("authentication failed") ||
    lowerText.includes("invalid login") ||
    lowerText.includes("auth") ||
    lowerText.includes("login failed");

  const isTimeout =
    lowerText.includes("timed out") ||
    lowerText.includes("timeout") ||
    lowerText.includes("etimedout");

  const isConnectionFailure =
    lowerText.includes("econnrefused") ||
    lowerText.includes("enotfound") ||
    lowerText.includes("ehostunreach") ||
    lowerText.includes("closed unexpectedly") ||
    lowerText.includes("connection closed");

  if (providerId === "naver") {
    if (isAuthFailure) {
      return new Error(
        "네이버 메일 인증에 실패했습니다. 네이버 메일 PC 환경설정에서 IMAP/SMTP를 '사용함'으로 켠 뒤, 네이버 로그인 2단계 인증을 활성화하고 일반 비밀번호가 아닌 '애플리케이션 비밀번호'를 입력해 주세요.",
      );
    }

    if (isTimeout || isConnectionFailure) {
      return new Error(
        `네이버 메일 서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요. 문제가 계속되면 네이버 메일 PC 환경설정의 IMAP/SMTP 사용 상태와 휴면 여부를 확인해 주세요. (${context})`,
      );
    }
  }

  if (providerId === "gmail" && isAuthFailure) {
    return new Error(
      "Gmail 인증에 실패했습니다. Google 2단계 인증이 켜져 있는지, 그리고 일반 비밀번호가 아닌 앱 비밀번호를 입력했는지 확인해 주세요.",
    );
  }

  if (providerId === "outlook" && isAuthFailure) {
    return new Error(
      "Outlook 인증에 실패했습니다. 비밀번호가 정확한지, 그리고 계정 정책에서 IMAP/SMTP 기본 인증이 허용되는지 확인해 주세요.",
    );
  }

  if (isTimeout || isConnectionFailure) {
    return new Error(`메일 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요. (${context})`);
  }

  return error;
}

function parseAddressList(input: Awaited<ReturnType<typeof simpleParser>>["to"]) {
  const normalizedInput = input as AddressLike | undefined;
  const values = Array.isArray(normalizedInput)
    ? normalizedInput.flatMap((item) => item.value ?? [])
    : normalizedInput?.value ?? [];

  return values
    .map((item: AddressEntry) => item.address?.trim())
    .filter((value): value is string => Boolean(value));
}

function normalizeThread(account: StoredAccount, providerMessageId: string, parsed: Awaited<ReturnType<typeof simpleParser>>, unread: boolean, receivedAt: Date) {
  const sender = parsed.from?.value?.[0];
  const fromEmail = sender?.address ?? account.email;
  const fromName = sender?.name ?? fromEmail;
  const bodyText = parsed.text?.trim() || "";
  const preview = bodyText.replace(/\s+/g, " ").slice(0, 160) || parsed.subject || "(제목 없음)";
  const category = classifyThread({
    fromEmail,
    subject: parsed.subject || "(제목 없음)",
    preview,
  });
  const hasAction = shouldMarkAction({
    subject: parsed.subject || "",
    preview,
    bodyText,
  });

  const thread: Thread = {
    id: buildThreadId(account.id, providerMessageId),
    userId: account.userId,
    accountId: account.id,
    from: fromName,
    fromEmail,
    to: parseAddressList(parsed.to),
    cc: parseAddressList(parsed.cc),
    bcc: [],
    subject: parsed.subject || "(제목 없음)",
    preview,
    receivedAt: receivedAt.toISOString(),
    unread,
    starred: false,
    archived: false,
    direction: "received",
    sentMode: null,
    sourceThreadId: null,
    providerMessageId,
    category,
    labelIds: [],
    attachments: (parsed.attachments ?? []).map((attachment) => ({
      name: attachment.filename || "attachment",
      size: formatAttachmentSize(attachment.size),
    })),
    hasAction,
    bodyHtml: typeof parsed.html === "string" ? parsed.html : undefined,
    bodyText,
    summary: {
      oneLine: "",
      threeLines: [],
      status: "pending",
      model: "imap-ingest",
      updatedAt: new Date().toISOString(),
    },
  };

  return compactThreadForStorage({
    ...thread,
    summary: generateSummary(thread),
  });
}

async function fetchImapThreads(account: StoredAccount, options?: SyncInboxOptions) {
  await assertCustomMailAccountSafety(account);
  const client = new ImapFlow({
    ...resolveAccountConfig(account),
    logger: false,
  });

  let lock: Awaited<ReturnType<typeof client.getMailboxLock>> | null = null;

  try {
    await client.connect();
    lock = await client.getMailboxLock("INBOX");

    const uidList = await client.search({ all: true }, { uid: true });
    if (!uidList || uidList.length === 0) {
      return [] as Thread[];
    }

    const sortedUids = [...uidList].sort((a, b) => a - b);
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? DEFAULT_IMAP_SYNC_LIMIT);
    const endExclusive = Math.max(0, sortedUids.length - offset);
    const startInclusive = Math.max(0, endExclusive - limit);
    const selectedUids = sortedUids.slice(startInclusive, endExclusive);

    if (selectedUids.length === 0) {
      return [] as Thread[];
    }

    const threads: Thread[] = [];

    // Fetch the requested remote page in chunks so load-more can backfill older mail gradually.
    for (let index = 0; index < selectedUids.length; index += IMAP_FETCH_BATCH_SIZE) {
      const batchUids = selectedUids.slice(index, index + IMAP_FETCH_BATCH_SIZE);

      for await (const message of client.fetch(batchUids, {
        envelope: true,
        flags: true,
        internalDate: true,
        source: true,
      }, {
        uid: true,
      })) {
        if (!message.source) {
          continue;
        }

        const parsed = await simpleParser(Buffer.from(message.source));
        const unread = !(message.flags?.has?.("\\Seen") ?? false);
        const providerMessageId =
          parsed.messageId ||
          message.uid?.toString() ||
          `${account.email}-${randomUUID()}`;

        const internalDate =
          message.internalDate instanceof Date
            ? message.internalDate
            : message.internalDate
              ? new Date(message.internalDate)
              : new Date();

        threads.push(
          normalizeThread(
            account,
            providerMessageId,
            parsed,
            unread,
            internalDate,
          ),
        );
      }
    }

    return threads.sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
  } catch (error) {
    throw mapImapProviderError(account.driverId as Exclude<ProviderId, "mock">, error, "imap-sync");
  } finally {
    if (lock) {
      lock.release();
    }

    if (client.usable) {
      await client.logout();
    }
  }
}

async function sendViaSmtp(input: SendMailInput): Promise<SendMailReceipt> {
  await assertCustomMailAccountSafety(input.account);
  const smtpConfig = resolveSmtpConfig(input.account);
  const transport = nodemailer.createTransport(smtpConfig);
  const from = input.account.label
    ? `"${input.account.label}" <${input.account.email}>`
    : input.account.email;

  let info;

  try {
    info = await transport.sendMail({
      from,
      to: input.to,
      cc: input.cc.length > 0 ? input.cc : undefined,
      bcc: input.bcc.length > 0 ? input.bcc : undefined,
      subject: input.subject,
      text: input.body,
      inReplyTo: input.mode === "reply" ? input.originalThread?.providerMessageId : undefined,
      references:
        input.mode === "reply" && input.originalThread?.providerMessageId
          ? [input.originalThread.providerMessageId]
          : undefined,
    });
  } catch (error) {
    throw mapImapProviderError(input.account.driverId as Exclude<ProviderId, "mock">, error, "smtp-send");
  }

  return {
    accepted: info.accepted.map((value: string | { toString(): string }) => value.toString()),
    rejected: info.rejected.map((value: string | { toString(): string }) => value.toString()),
    providerMessageId: info.messageId,
    deliverySummary: `${smtpConfig.host}:${smtpConfig.port} via SMTP`,
  };
}

export function createImapDriver(providerId: Exclude<ProviderId, "mock">): MailProviderDriver {
  const preset = PRESETS[providerId];

  return {
    descriptor: {
      id: providerId,
      label: preset.label,
      description: preset.description,
      authType: preset.authType,
      provider: preset.provider,
      fields:
        providerId === "custom-imap"
          ? [
              {
                name: "imapHost",
                label: "IMAP Host",
                type: "text",
                placeholder: "mail.example.com",
                required: true,
              },
              {
                name: "imapPort",
                label: "IMAP Port",
                type: "number",
                placeholder: "993",
                required: true,
                defaultValue: "993",
              },
              {
                name: "imapSecure",
                label: "TLS 사용 여부",
                type: "text",
                placeholder: "true",
                required: true,
                defaultValue: "true",
              },
              {
                name: "smtpHost",
                label: "SMTP Host",
                type: "text",
                placeholder: "smtp.example.com",
                required: true,
              },
              {
                name: "smtpPort",
                label: "SMTP Port",
                type: "number",
                placeholder: "587",
                required: true,
                defaultValue: "587",
              },
              {
                name: "smtpSecure",
                label: "SMTP TLS 사용 여부",
                type: "text",
                placeholder: "false",
                required: true,
                defaultValue: "false",
              },
              {
                name: "password",
                label: "비밀번호",
                type: "password",
                required: true,
              },
            ]
          : [
              {
                name: "password",
                label: providerId === "gmail" || providerId === "naver" ? "앱 비밀번호" : "비밀번호",
                type: "password",
                required: true,
                helpText:
                  providerId === "naver"
                    ? "네이버 메일 PC 환경설정에서 IMAP/SMTP 사용함을 켠 뒤, 2단계 인증 후 발급한 애플리케이션 비밀번호를 입력하세요."
                    : providerId === "gmail"
                      ? "2단계 인증 후 발급한 앱 비밀번호를 입력하세요."
                    : "IMAP 접근이 가능한 계정 비밀번호를 입력하세요.",
              },
            ],
    },
    async prepareAccount(input: ConnectAccountPayload): Promise<PreparedAccount> {
      const email = requireValue(input.email, "이메일");
      const password = requireValue(input.secrets?.password, "비밀번호");

      const settings =
        providerId === "custom-imap"
          ? (() => {
              const customSettings = {
                imapHost: normalizeHost(input.settings?.imapHost ?? "", "IMAP Host"),
                imapPort: parsePort(input.settings?.imapPort, "IMAP Port"),
                imapSecure: parseBooleanFlag(input.settings?.imapSecure, "IMAP TLS 사용 여부", "true"),
                smtpHost: normalizeHost(input.settings?.smtpHost ?? "", "SMTP Host"),
                smtpPort: parsePort(input.settings?.smtpPort, "SMTP Port"),
                smtpSecure: parseBooleanFlag(input.settings?.smtpSecure, "SMTP TLS 사용 여부", "false"),
              };

              return customSettings;
            })()
          : undefined;

      if (settings) {
        await assertSafeRemoteHost(settings.imapHost, "IMAP Host");
        await assertSafeRemoteHost(settings.smtpHost, "SMTP Host");
      }

      return {
        provider: preset.provider,
        label: input.label?.trim() || preset.label,
        connectionSummary:
          providerId === "custom-imap"
            ? `${input.settings?.imapHost}:${input.settings?.imapPort}`
            : `${preset.host}:${preset.port} via IMAP`,
        secrets: {
          password,
        },
        settings: settings ? { ...settings, email } : undefined,
      };
    },
    async syncInbox(account: StoredAccount, options?: SyncInboxOptions) {
      return fetchImapThreads(account, options);
    },
    async sendMail(input: SendMailInput) {
      return sendViaSmtp(input);
    },
  };
}
