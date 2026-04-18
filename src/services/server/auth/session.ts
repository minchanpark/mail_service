import { NextResponse, type NextRequest } from "next/server";

import type { User } from "@/models";

const SESSION_COOKIE_NAME = "mail_service_demo_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

class RouteAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isRemoteAccessEnabled() {
  return process.env.MAIL_SERVICE_ALLOW_REMOTE_ACCESS === "true";
}

function getSessionSecret() {
  return process.env.MAIL_SERVICE_SESSION_SECRET?.trim() || `mail-service-local-demo:${process.cwd()}`;
}

function isMutationMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function getRequestUrl(request: Request | NextRequest) {
  return new URL(request.url);
}

function getRequestHostname(request: Request | NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim() ?? "";
    if (host.startsWith("[")) {
      const closingIndex = host.indexOf("]");
      if (closingIndex > 0) {
        return host.slice(1, closingIndex).toLowerCase();
      }
    }

    return host.split(":")[0].toLowerCase();
  }

  return getRequestUrl(request).hostname.toLowerCase();
}

export function isLoopbackRequest(request: Request | NextRequest) {
  return LOOPBACK_HOSTS.has(getRequestHostname(request));
}

function ensureHostAccess(request: Request | NextRequest) {
  if (isRemoteAccessEnabled() || isLoopbackRequest(request)) {
    return;
  }

  throw new RouteAccessError(
    403,
    "이 데모 앱은 기본적으로 localhost에서만 사용할 수 있습니다. 원격 접속이 필요하면 MAIL_SERVICE_ALLOW_REMOTE_ACCESS=true 로 명시적으로 허용해 주세요.",
  );
}

function ensureSameOriginMutation(request: Request | NextRequest) {
  if (!isMutationMethod(request.method)) {
    return;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "none"].includes(secFetchSite)) {
    throw new RouteAccessError(403, "교차 출처 요청은 허용되지 않습니다.");
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const requestOrigin = getRequestUrl(request).origin;
  if (origin !== requestOrigin) {
    throw new RouteAccessError(403, "잘못된 요청 origin입니다.");
  }
}

function parseCookieValue(request: Request | NextRequest, cookieName: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${cookieName}=`)) {
      continue;
    }

    return decodeURIComponent(part.slice(cookieName.length + 1));
  }

  return null;
}

async function signSessionPayload(payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Buffer.from(new Uint8Array(signature)).toString("base64url");
}

async function buildSessionToken(now = Date.now()) {
  const issuedAt = String(Math.floor(now / 1000));
  const payload = `v1.${issuedAt}`;
  const signature = await signSessionPayload(payload);
  return `${payload}.${signature}`;
}

async function isValidSessionToken(token: string | null) {
  if (!token) {
    return false;
  }

  const [version, issuedAt, signature] = token.split(".");
  if (version !== "v1" || !issuedAt || !signature) {
    return false;
  }

  const issuedAtSeconds = Number.parseInt(issuedAt, 10);
  if (!Number.isFinite(issuedAtSeconds)) {
    return false;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAtSeconds;
  if (ageSeconds < 0 || ageSeconds > SESSION_TTL_SECONDS) {
    return false;
  }

  const expectedSignature = await signSessionPayload(`v1.${issuedAt}`);
  return signature === expectedSignature;
}

export async function applyDemoSession(request: NextRequest, response: NextResponse) {
  ensureHostAccess(request);

  const token = parseCookieValue(request, SESSION_COOKIE_NAME);
  if (await isValidSessionToken(token)) {
    return response;
  }

  response.cookies.set(SESSION_COOKIE_NAME, await buildSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}

export async function requireAuthenticatedUser(request: Request | NextRequest): Promise<User> {
  ensureHostAccess(request);
  ensureSameOriginMutation(request);

  const token = parseCookieValue(request, SESSION_COOKIE_NAME);
  if (!(await isValidSessionToken(token))) {
    throw new RouteAccessError(401, "세션이 없습니다. localhost에서 앱을 다시 열어 주세요.");
  }

  const { readState } = await import("@/services/server/store/file-store");
  const state = await readState();
  return state.user;
}

export function createRouteErrorResponse(error: unknown, fallbackMessage: string, defaultStatus = 400) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = error instanceof RouteAccessError ? error.status : defaultStatus;
  return NextResponse.json({ error: message }, { status });
}
