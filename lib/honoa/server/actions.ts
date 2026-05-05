"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginWithPassword, logoutCurrentSession, homePathForUser, requireCurrentUser } from "./auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const user = await loginWithPassword(email, password).catch(() => null);
  if (!user) redirect("/login?error=invalid");
  redirect(homePathForUser(user));
}

export async function logoutAction() {
  await logoutCurrentSession();
  redirect("/login");
}

export async function revalidateKingaPaths(...paths: string[]) {
  await requireCurrentUser();
  for (const path of paths) revalidatePath(path);
}
