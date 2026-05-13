import Link from "next/link";
import { KingaShell } from "@/components/kinga-shell";
import { hasAnyServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";

export default async function FinancePage() {
  const user = await requireCurrentUser();
  const canReceiptAccounts = hasAnyServerPermission(user, ["finance.receipt_accounts.view", "finance.receipt_accounts.manage"]);
  const canUseQuoteSourceDryRun = user.role === "super_admin";
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / 财务部</div>
          <h1>财务部</h1>
          <p className="muted">
            本阶段开放官方收款账号管理，并提供 super_admin 内部报价表 dry-run 结构识别。财务价格管理、报价核价等功能仍暂未开放。
          </p>
        </div>
        <section className="grid">
          {canReceiptAccounts ? (
            <Link className="card open" href="/finance/receipt-accounts">
              <h2>收款账号管理</h2>
              <p>财务集中维护坤江官方收款账号，业务端只能选择官方方案。</p>
              <span className="tag ok">已开放</span>
            </Link>
          ) : (
            <div className="card disabled">
              <h2>收款账号管理</h2>
              <p className="muted">当前账号没有查看收款账号权限。</p>
              <span className="tag warn">无权限</span>
            </div>
          )}
          {canUseQuoteSourceDryRun ? (
            <Link className="card open" href="/finance/quote-source-dry-run">
              <h2>报价表 dry-run</h2>
              <p>本地识别财务报价表结构，不上传、不入库、不生成正式报价。</p>
              <span className="tag warn">内部测试</span>
            </Link>
          ) : null}
          {["价格表设置", "上传价格表", "统一改价", "报价核价"].map((module) => (
            <div className="card disabled" key={module}>
              <h2>{module}</h2>
              <p className="muted">暂未开放</p>
              <span className="tag warn">不可进入</span>
            </div>
          ))}
        </section>
      </div>
    </KingaShell>
  );
}
