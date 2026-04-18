import { NextResponse } from "next/server";

import { getBriefing } from "@/lib/server/services/inbox-service";

export async function GET() {
  const briefing = await getBriefing();
  return NextResponse.json(briefing);
}
