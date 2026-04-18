import { NextResponse } from "next/server";
import { z } from "zod";

import { createLabel, listLabels } from "@/lib/server/services/inbox-service";

const labelSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(4),
});

export async function GET() {
  const labels = await listLabels();
  return NextResponse.json(labels);
}

export async function POST(request: Request) {
  try {
    const payload = labelSchema.parse(await request.json());
    const label = await createLabel(payload);
    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "라벨 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
