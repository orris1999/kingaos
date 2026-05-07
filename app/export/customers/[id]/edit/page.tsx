import { CustomerAttachmentsPanel } from "@/components/customer-attachments-panel";
import { ServerCustomerForm } from "@/components/server-customer-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer, getExportCustomerForActor, getExportOwners } from "@/lib/honoa/server/customers";
import { prisma } from "@/lib/honoa/server/db";
import { getCustomerAttachmentTypes } from "@/lib/honoa/server/field-config";
import { isOssConfigured } from "@/lib/honoa/server/oss";
import { listSelectableReceiptAccounts } from "@/lib/honoa/server/receipt-accounts";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  try {
    const customer = await getExportCustomerForActor(user, id);
    if (!canEditCustomerServer(user, customer)) throw new Error("当前账号不能编辑该客户。");
    const [fields, owners, receiptAccounts, attachmentTypes] = await Promise.all([
      prisma.customerFieldConfig.findMany({ where: { moduleKey: "export_customer", isActive: true }, orderBy: { sortOrder: "asc" } }),
      getExportOwners(),
      listSelectableReceiptAccounts(customer.defaultReceiptAccountId),
      getCustomerAttachmentTypes()
    ]);
    return (
      <KingaShell user={user}>
        <div className="stack">
          <ServerCustomerForm actor={user} customer={customer} fields={fields} owners={owners} receiptAccounts={receiptAccounts} attachmentTypes={attachmentTypes} ossConfigured={isOssConfigured()} />
          <CustomerAttachmentsPanel customerId={customer.id} attachments={customer.attachments || []} editable />
        </div>
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
