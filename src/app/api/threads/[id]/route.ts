import { NextResponse } from "next/server";
import { z } from "zod";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/lib/server/auth/session";
import { getThread, updateThread } from "@/lib/server/services/inbox-service";

const patchThreadSchema = z
  .object({
    unread: z.boolean().optional(),
    starred: z.boolean().optional(),
    archived: z.boolean().optional(),
    snoozedUntil: z.string().datetime().nullable().optional(),
    labelIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const thread = await getThread(viewer.id, id);

    if (!thread) {
      return NextResponse.json({ error: "메일을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(thread);
  } catch (error) {
    return createRouteErrorResponse(error, "메일을 불러오지 못했습니다.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const payload = patchThreadSchema.parse(await request.json());
    const thread = await updateThread(viewer.id, id, payload);
    return NextResponse.json(thread);
  } catch (error) {
    return createRouteErrorResponse(error, "메일 업데이트에 실패했습니다.");
  }
}
