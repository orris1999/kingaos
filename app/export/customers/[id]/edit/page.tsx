import { ServerCustomerForm } from "@/components/server-customer-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer, getExportCustomerForActor, getExportOwners } from "@/lib/honoa/server/customers";
import { prisma } from "@/lib/honoa/server/db";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  try {
    const customer = await getExportCustomerForActor(user, id);
    if (!canEditCustomerServer(user, customer)) throw new Error("当前账号不能编辑该客户。");
    const [fields, owners] = await Promise.all([
      prisma.customerFieldConfig.findMany({ where: { moduleKey: "export_customer", isActive: true }, orderBy: { sortOrder: "asc" } }),
      getExportOwners()
    ]);
    return (
      <KingaShell user={user}>
        <ServerCustomerForm actor={user} customer={customer} fields={fields} owners={owners} />
      </KingaShell>
    );
  } catch (error) {
    return (
      <KingaShell user={user}>
        <Forbidden message={error instanceof Error ? error.message : "当前账号不能编辑该客户。"} />
      </KingaShell>
    );
  }
}
