import { NextResponse } from "next/server";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/lib/server/auth/session";
import { listAccounts } from "@/lib/server/services/inbox-service";

export async function GET(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const accounts = await listAccounts(viewer.id);
    return NextResponse.json(accounts);
  } catch (error) {
    return createRouteErrorResponse(error, "계정 목록을 불러오지 못했습니다.");
  }
}
