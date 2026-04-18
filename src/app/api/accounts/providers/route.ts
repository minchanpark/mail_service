import { NextResponse } from "next/server";

import { listAvailableProviders } from "@/lib/server/services/inbox-service";

export async function GET() {
  const providers = await listAvailableProviders();
  return NextResponse.json(providers);
}
