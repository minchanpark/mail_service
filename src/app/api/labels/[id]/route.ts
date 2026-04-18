import { NextResponse } from "next/server";
import { z } from "zod";

import { removeLabel, updateLabel } from "@/lib/server/services/inbox-service";

const updateLabelSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(4).optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = updateLabelSchema.parse(await request.json());
    const label = await updateLabel(id, payload);
    return NextResponse.json(label);
  } catch (error) {
    const message = error instanceof Error ? error.message : "라벨 수정에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await removeLabel(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "라벨 삭제에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
