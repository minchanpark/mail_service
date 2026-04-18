import { NextResponse } from "next/server";
import { z } from "zod";

import { createRouteErrorResponse, requireAuthenticatedUser } from "@/lib/server/auth/session";
import { createLabel, listLabels } from "@/lib/server/services/inbox-service";

const labelSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(4),
});

export async function GET(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const labels = await listLabels(viewer.id);
    return NextResponse.json(labels);
  } catch (error) {
    return createRouteErrorResponse(error, "라벨 목록을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireAuthenticatedUser(request);
    const payload = labelSchema.parse(await request.json());
    const label = await createLabel(viewer.id, payload);
    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    return createRouteErrorResponse(error, "라벨 생성에 실패했습니다.");
  }
}
