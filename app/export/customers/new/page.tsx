import { ServerCustomerForm } from "@/components/server-customer-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { getExportOwners } from "@/lib/honoa/server/customers";
import { prisma } from "@/lib/honoa/server/db";

export default async function NewCustomerPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "export.customers.create")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能新建客户。" />
      </KingaShell>
    );
  }
  const [fields, owners] = await Promise.all([
    prisma.customerFieldConfig.findMany({ where: { moduleKey: "export_customer", isActive: true }, orderBy: { sortOrder: "asc" } }),
    getExportOwners()
  ]);
  return (
    <KingaShell user={user}>
      <ServerCustomerForm actor={user} fields={fields} owners={owners} />
    </KingaShell>
  );
}
