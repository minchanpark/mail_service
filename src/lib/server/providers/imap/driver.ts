import { randomUUID } from "node:crypto";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import {
  classifyThread,
  generateSummary,
  shouldMarkAction,
} from "@/lib/server/services/ai-service";
import { buildThreadId, formatAttachmentSize } from "@/lib/server/providers/helpers";
import type { MailProviderDriver, PreparedAccount } from "@/lib/server/providers/types";
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
  authType: "app-password" | "basic";
};

const PRESETS: Record<Exclude<ProviderId, "mock">, ImapPreset> = {
  gmail: {
    provider: "gmail",
    label: "Gmail",
    description: "Gmail IMAP 계정을 앱 비밀번호로 연결합니다.",
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    authType: "app-password",
  },
  outlook: {
    provider: "outlook",
    label: "Outlook",
    description: "Microsoft 365 / Outlook.com IMAP 계정을 연결합니다.",
    host: "outlook.office365.com",
    port: 993,
    secure: true,
    authType: "basic",
  },
  naver: {
    provider: "naver",
    label: "Naver",
    description: "Naver IMAP 계정을 앱 비밀번호로 연결합니다.",
    host: "imap.naver.com",
    port: 993,
    secure: true,
    authType: "app-password",
  },
  "custom-imap": {
    provider: "custom-imap",
    label: "Custom IMAP",
    description: "임의의 IMAP 서버를 직접 입력해 연결합니다.",
    authType: "basic",
  },
};

function requireValue(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} 값이 필요합니다.`);
  }
  return normalized;
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
    subject: parsed.subject || "(제목 없음)",
    preview,
    receivedAt: receivedAt.toISOString(),
    unread,
    starred: false,
    archived: false,
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

  return {
    ...thread,
    summary: generateSummary(thread),
  };
}

async function fetchImapThreads(account: StoredAccount) {
  const client = new ImapFlow({
    ...resolveAccountConfig(account),
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const exists = client.mailbox ? client.mailbox.exists ?? 0 : 0;
    if (exists <= 0) {
      return [] as Thread[];
    }

    const start = Math.max(1, exists - 24);
    const threads: Thread[] = [];

    for await (const message of client.fetch(`${start}:*`, {
      envelope: true,
      flags: true,
      internalDate: true,
      source: true,
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

    return threads.sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
  } finally {
    lock.release();
    await client.logout();
  }
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
                  providerId === "gmail" || providerId === "naver"
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
          ? {
              imapHost: requireValue(input.settings?.imapHost, "IMAP Host"),
              imapPort: requireValue(input.settings?.imapPort, "IMAP Port"),
              imapSecure: input.settings?.imapSecure?.trim() || "true",
            }
          : undefined;

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
    async syncInbox(account: StoredAccount) {
      return fetchImapThreads(account);
    },
  };
}
