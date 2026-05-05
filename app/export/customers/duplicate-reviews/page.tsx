import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasAnyServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import { listCustomerDuplicateReviewRequestsForActor } from "@/lib/honoa/server/customers";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function statusLabel(status: string) {
  if (status === "pending") return "待审核";
  if (status === "approved") return "已通过";
  if (status === "rejected") return "已拒绝";
  if (status === "cancelled") return "已取消";
  return status;
}

export default async function DuplicateReviewsPage() {
  const user = await requireCurrentUser();
  if (!hasAnyServerPermission(user, ["export.customers.create", "export.customers.duplicate_review.view", "export.customers.duplicate_review.manage"])) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看重复客户审核。" />
      </KingaShell>
    );
  }
  const requests = await listCustomerDuplicateReviewRequestsForActor(user);
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div className="split">
          <div>
            <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / 重复客户审核</div>
            <h1>重复客户审核</h1>
            <p className="muted">客户名称加点、加空格、大小写或全角半角变化都不能绕过判重。重复客户必须审核通过后才允许例外建档。</p>
          </div>
          <Link className="button ghost" href="/export/customers">返回客户列表</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>申请时间</th><th>申请人</th><th>拟建客户名称</th><th>规范化名称</th><th>疑似已有客户数量</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {requests.length === 0 ? <tr><td colSpan={7}>暂无重复客户审核申请</td></tr> : requests.map((request) => (
                <tr key={request.id}>
                  <td>{formatDate(request.createdAt)}</td>
                  <td>{request.requestedByName || "-"}</td>
                  <td>{request.proposedCustomerName}</td>
                  <td>{request.normalizedName}</td>
                  <td>{Array.isArray(request.existingCustomerIds) ? request.existingCustomerIds.length : 0}</td>
                  <td><span className={request.status === "pending" ? "tag warn" : request.status === "approved" ? "tag ok" : "tag danger"}>{statusLabel(request.status)}</span></td>
                  <td><Link href={`/export/customers/duplicate-reviews/${request.id}`}>查看</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </KingaShell>
  );
}
