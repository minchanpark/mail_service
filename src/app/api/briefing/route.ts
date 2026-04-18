import { NextResponse } from "next/server";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/services/server/auth/session";
import { getBriefing } from "@/services/server/services/inbox-service";

export async function GET(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const briefing = await getBriefing(viewer.id);
    return NextResponse.json(briefing);
  } catch (error) {
    return createRouteErrorResponse(error, "브리핑을 불러오지 못했습니다.");
  }
}
