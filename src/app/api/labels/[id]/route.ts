import { NextResponse } from "next/server";
import { z } from "zod";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/lib/server/auth/session";
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
    const viewer = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const payload = updateLabelSchema.parse(await request.json());
    const label = await updateLabel(viewer.id, id, payload);
    return NextResponse.json(label);
  } catch (error) {
    return createRouteErrorResponse(error, "라벨 수정에 실패했습니다.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    await removeLabel(viewer.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return createRouteErrorResponse(error, "라벨 삭제에 실패했습니다.");
  }
}
