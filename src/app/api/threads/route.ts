import { NextResponse } from "next/server";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/lib/server/auth/session";
import { listThreads } from "@/lib/server/services/inbox-service";
import type { Category, ThreadFilter, ThreadView } from "@/lib/shared/types";

function parseView(value: string | null): ThreadView {
  const allowed: ThreadView[] = ["all", "unread", "needsReply", "starred", "sent", "snoozed"];
  return allowed.includes((value as ThreadView) ?? "all") ? (value as ThreadView) : "all";
}

function parseCategory(value: string | null): Category | undefined {
  const allowed: Category[] = ["important", "newsletter", "transaction", "automation", "other"];
  return allowed.includes(value as Category) ? (value as Category) : undefined;
}

function parsePositiveInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const filter: ThreadFilter = {
      kind: parseView(searchParams.get("kind")),
      accountId: searchParams.get("accountId") ?? undefined,
      category: parseCategory(searchParams.get("category")),
      labelId: searchParams.get("labelId") ?? undefined,
      query: searchParams.get("query") ?? undefined,
      page: parsePositiveInteger(searchParams.get("page")),
      pageSize: parsePositiveInteger(searchParams.get("pageSize")),
    };

    const result = await listThreads(viewer.id, filter);
    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(error, "메일 목록을 불러오지 못했습니다.");
  }
}
