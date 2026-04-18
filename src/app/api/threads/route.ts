import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter: ThreadFilter = {
    kind: parseView(searchParams.get("kind")),
    accountId: searchParams.get("accountId") ?? undefined,
    category: parseCategory(searchParams.get("category")),
    labelId: searchParams.get("labelId") ?? undefined,
    query: searchParams.get("query") ?? undefined,
  };

  const result = await listThreads(filter);
  return NextResponse.json(result);
}
