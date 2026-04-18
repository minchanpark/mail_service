import { NextResponse } from "next/server";
import { z } from "zod";

import { connectAccount } from "@/lib/server/services/inbox-service";

const connectAccountSchema = z.object({
  driverId: z.enum(["mock", "gmail", "outlook", "naver", "custom-imap"]),
  email: z.string().email(),
  label: z.string().optional(),
  secrets: z.record(z.string(), z.string()).optional(),
  settings: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = connectAccountSchema.parse(await request.json());
    const account = await connectAccount(payload);
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "계정 연결에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
