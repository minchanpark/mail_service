import { NextResponse } from "next/server";
import { z } from "zod";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/services/server/auth/session";
import { summarizeThread } from "@/services/server/services/inbox-service";

const summarizeSchema = z.object({
  threadId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const payload = summarizeSchema.parse(await request.json());
    const summary = await summarizeThread(viewer.id, payload.threadId);
    return NextResponse.json(summary);
  } catch (error) {
    return createRouteErrorResponse(error, "요약 생성에 실패했습니다.");
  }
}
