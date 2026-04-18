import { NextResponse } from "next/server";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/services/server/auth/session";
import { getCurrentUser } from "@/services/server/services/inbox-service";

export async function GET(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const user = await getCurrentUser();
    if (viewer.id !== user.id) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return createRouteErrorResponse(error, "사용자 정보를 불러오지 못했습니다.");
  }
}
