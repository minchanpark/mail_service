import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/services/inbox-service";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(user);
}
