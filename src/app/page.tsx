import { connection } from "next/server";

import { InboxPage } from "@/views/inbox/inbox-page";

export default async function HomePage() {
  await connection();
  return <InboxPage />;
}
