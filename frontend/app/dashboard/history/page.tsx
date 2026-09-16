import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ConversationHistory } from "@/components/conversation-history";
import { authOptions } from "@/lib/auth";

export default async function ConversationHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  return <ConversationHistory />;
}
