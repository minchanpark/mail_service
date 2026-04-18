import { NextResponse } from "next/server";

import { listAccounts } from "@/lib/server/services/inbox-service";

export async function GET() {
  const accounts = await listAccounts();
  return NextResponse.json(accounts);
}
