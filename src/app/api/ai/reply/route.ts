import { NextResponse } from "next/server";
import { z } from "zod";

import { generateReply } from "@/lib/server/services/inbox-service";

const replySchema = z.object({
  threadId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = replySchema.parse(await request.json());
    const reply = await generateReply(payload.threadId);
    return NextResponse.json(reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "답장 초안 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
