import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams({ tab: "staff" });
  if (params.error) {
    query.set("error", params.error);
  }
  redirect(`/login?${query.toString()}`);
}
