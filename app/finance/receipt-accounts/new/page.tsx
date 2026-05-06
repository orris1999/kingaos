import Link from "next/link";
import { ReceiptAccountForm } from "@/components/receipt-account-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { createReceiptAccountAction } from "@/lib/honoa/server/receipt-accounts";

export default async function NewReceiptAccountPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "finance.receipt_accounts.manage")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能新增官方收款账号。" />
      </KingaShell>
    );
  }
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / 财务部 / 收款账号管理 / 新增</div>
          <h1>新增收款账号</h1>
          <p className="muted">请填写坤江官方收款账号。业务员只能选择方案，不能维护账号明细。</p>
        </div>
        <section className="panel stack">
          <ReceiptAccountForm action={createReceiptAccountAction} />
        </section>
        <Link className="button ghost" href="/finance/receipt-accounts">返回列表</Link>
      </div>
    </KingaShell>
  );
}
