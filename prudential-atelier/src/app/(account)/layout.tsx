import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountLayout } from "@/components/account/AccountLayout";

export default async function AccountGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login?callbackUrl=/account");
  }

  return <AccountLayout session={session}>{children}</AccountLayout>;
}
