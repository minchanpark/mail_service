import { NextResponse } from "next/server";
import { z } from "zod";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/services/server/auth/session";
import { connectAccount } from "@/services/server/services/inbox-service";

const connectAccountSchema = z.object({
  driverId: z.enum(["gmail", "outlook", "naver", "custom-imap"]),
  email: z.string().email(),
  label: z.string().optional(),
  secrets: z.record(z.string(), z.string()).optional(),
  settings: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const payload = connectAccountSchema.parse(await request.json());
    const account = await connectAccount(viewer.id, payload);
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return createRouteErrorResponse(error, "계정 연결에 실패했습니다.");
  }
}
