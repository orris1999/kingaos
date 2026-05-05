import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { ServerUserForm } from "@/components/server-user-form";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function NewUserPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "users.create")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号没有用户创建权限。" />
      </KingaShell>
    );
  }
  return (
    <KingaShell user={user}>
      <ServerUserForm actor={user} />
    </KingaShell>
  );
}
