import Link from "next/link";
import { ReceiptAccountForm } from "@/components/receipt-account-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { getReceiptAccountForActor, updateReceiptAccountAction } from "@/lib/honoa/server/receipt-accounts";

export default async function EditReceiptAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  if (!hasServerPermission(user, "finance.receipt_accounts.manage")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能编辑官方收款账号。" />
      </KingaShell>
    );
  }
  try {
    const account = await getReceiptAccountForActor(user, id);
    return (
      <KingaShell user={user}>
        <div className="stack">
          <div>
            <div className="breadcrumbs">KingaOS / 财务部 / 收款账号管理 / 编辑</div>
            <h1>编辑收款账号：{account.displayName}</h1>
            <p><span className="tag">账号编号：{account.accountCode}</span></p>
          </div>
          <section className="panel stack">
            <ReceiptAccountForm account={account} action={updateReceiptAccountAction.bind(null, account.id)} />
          </section>
          <Link className="button ghost" href={`/finance/receipt-accounts/${account.id}`}>返回详情</Link>
        </div>
      </KingaShell>
    );
  } catch (error) {
    return (
      <KingaShell user={user}>
        <Forbidden message={error instanceof Error ? error.message : "当前账号不能编辑官方收款账号。"} />
      </KingaShell>
    );
  }
}
