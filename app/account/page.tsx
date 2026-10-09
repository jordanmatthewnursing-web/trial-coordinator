import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import AccountPlanner from "@/components/AccountPlanner";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await requireChatGPTUser("/account");
  return (
    <AccountPlanner
      displayName={user.displayName}
      signOut={chatGPTSignOutPath("/")}
    />
  );
}
