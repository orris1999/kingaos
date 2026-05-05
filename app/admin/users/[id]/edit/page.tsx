import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { ServerUserForm } from "@/components/server-user-form";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { getUserForEdit } from "@/lib/honoa/server/users";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "users.edit")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号没有用户编辑权限。" />
      </KingaShell>
    );
  }
  const { id } = await params;
  const target = await getUserForEdit(user, id);
  return (
    <KingaShell user={user}>
      {target ? <ServerUserForm actor={user} target={target} /> : <Forbidden message="用户不存在。" />}
    </KingaShell>
  );
}
