import { NextResponse } from "next/server";
import { z } from "zod";

import { summarizeThread } from "@/lib/server/services/inbox-service";

const summarizeSchema = z.object({
  threadId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = summarizeSchema.parse(await request.json());
    const summary = await summarizeThread(payload.threadId);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "요약 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
