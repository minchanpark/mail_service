import { NextResponse } from "next/server";
import { z } from "zod";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/lib/server/auth/session";
import { generateMailDrafts } from "@/lib/server/services/inbox-service";

const mailDraftSchema = z
  .object({
    mode: z.enum(["compose", "reply", "forward"]),
    threadId: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    prompt: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.mode !== "compose" && !value.threadId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "답장/전달 초안에는 원본 메일 ID가 필요합니다.",
        path: ["threadId"],
      });
    }
  });

export async function POST(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const payload = mailDraftSchema.parse(await request.json());
    const result = await generateMailDrafts(viewer.id, payload);
    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(error, "메일 초안 생성에 실패했습니다.");
  }
}
