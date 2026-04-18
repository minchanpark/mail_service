import { NextResponse } from "next/server";
import { z } from "zod";

import { sendMail } from "@/lib/server/services/inbox-service";

const sendMailSchema = z
  .object({
    mode: z.enum(["compose", "reply", "forward"]),
    accountId: z.string().min(1),
    threadId: z.string().min(1).optional(),
    to: z.array(z.string().email()).min(1),
    cc: z.array(z.string().email()).optional().default([]),
    bcc: z.array(z.string().email()).optional().default([]),
    subject: z.string().trim().min(1),
    body: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    if (value.mode !== "compose" && !value.threadId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "답장/전달에는 원본 메일 ID가 필요합니다.",
        path: ["threadId"],
      });
    }
  });

export async function POST(request: Request) {
  try {
    const payload = sendMailSchema.parse(await request.json());
    const result = await sendMail(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "메일 전송에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
