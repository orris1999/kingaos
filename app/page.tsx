import { getCurrentUser, homePathForUser } from "@/lib/honoa/server/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(homePathForUser(user));
}
