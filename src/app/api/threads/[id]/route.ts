import { NextResponse } from "next/server";

import { getThread, updateThread } from "@/lib/server/services/inbox-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const thread = await getThread(id);

  if (!thread) {
    return NextResponse.json({ error: "메일을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(thread);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const thread = await updateThread(id, payload);
    return NextResponse.json(thread);
  } catch (error) {
    const message = error instanceof Error ? error.message : "메일 업데이트에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
