import { NextResponse } from "next/server";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/services/server/auth/session";
import { listAvailableProviders } from "@/services/server/services/inbox-service";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    const providers = await listAvailableProviders();
    return NextResponse.json(providers);
  } catch (error) {
    return createRouteErrorResponse(error, "연결 가능한 메일 서버 목록을 불러오지 못했습니다.");
  }
}
