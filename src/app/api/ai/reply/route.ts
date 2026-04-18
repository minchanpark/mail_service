import { NextResponse } from "next/server";
import { z } from "zod";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/lib/server/auth/session";
import { generateReply } from "@/lib/server/services/inbox-service";

const replySchema = z.object({
  threadId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const payload = replySchema.parse(await request.json());
    const reply = await generateReply(viewer.id, payload.threadId);
    return NextResponse.json(reply);
  } catch (error) {
    return createRouteErrorResponse(error, "답장 초안 생성에 실패했습니다.");
  }
}
