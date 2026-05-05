import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import {
  approveCustomerDuplicateReviewRequestAction,
  getCustomerDuplicateReviewRequestForActor,
  rejectCustomerDuplicateReviewRequestAction
} from "@/lib/honoa/server/customers";
import { customerGeoDisplay } from "@/lib/honoa/shared/geo";

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

export default async function DuplicateReviewDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { submitted } = await searchParams;
  try {
    const { request, existingCustomers, requestedPayload } = await getCustomerDuplicateReviewRequestForActor(user, id);
    const canManage = hasServerPermission(user, "export.customers.duplicate_review.manage") && request.requestedByUserId !== user.id;
    const canSeeExistingCustomers = hasServerPermission(user, "export.customers.duplicate_review.view") || hasServerPermission(user, "export.customers.duplicate_review.manage");
    return (
      <KingaShell user={user}>
        <div className="stack">
          <div className="split">
            <div>
              <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / 重复客户审核 / 详情</div>
              <h1>客户名称已存在</h1>
              <p className="muted">系统检测到该客户可能已经建档。为避免多个业务员重复跟进同一客户，不能直接重复创建。</p>
            </div>
            <div className="actions">
              <Link className="button ghost" href="/export/customers/duplicate-reviews">返回审核列表</Link>
              <Link className="button ghost" href="/export/customers">返回客户列表</Link>
            </div>
          </div>
          {submitted ? <div className="panel"><span className="tag warn">已提交重复客户审核，等待业务经理确认。</span></div> : null}
          <section className="panel detail-grid">
            <div className="kv"><b>申请人</b><span>{request.requestedByName || "-"}</span></div>
            <div className="kv"><b>申请时间</b><span>{formatDate(request.createdAt)}</span></div>
            <div className="kv"><b>拟建客户名称</b><span>{request.proposedCustomerName}</span></div>
            <div className="kv"><b>系统识别的规范化名称</b><span>{request.normalizedName}</span></div>
            <div className="kv"><b>申请原因</b><span>{request.requestReason || "-"}</span></div>
            <div className="kv"><b>状态</b><span className={request.status === "pending" ? "tag warn" : request.status === "approved" ? "tag ok" : "tag danger"}>{statusLabel(request.status)}</span></div>
            <div className="kv"><b>审核人</b><span>{request.decidedByName || "-"}</span></div>
            <div className="kv"><b>审核意见</b><span>{request.decisionNote || "-"}</span></div>
          </section>
          <section className="panel stack">
            <h2>疑似已有客户</h2>
            {!canSeeExistingCustomers ? <p className="muted">系统已识别到疑似已有客户。普通业务员只能查看自己的申请状态，疑似客户详情由业务经理 / 管理员审核。</p> : null}
            {canSeeExistingCustomers ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>客户编号</th><th>客户名称</th><th>负责人</th><th>状态</th><th>地址</th><th>创建时间</th><th>更新时间</th></tr></thead>
                <tbody>
                  {existingCustomers.length === 0 ? <tr><td colSpan={7}>暂无可展示的疑似客户</td></tr> : existingCustomers.map((customer) => {
                    const geo = customerGeoDisplay(customer);
                    return (
                      <tr key={customer.id}>
                        <td>{customer.customerCode}</td>
                        <td>{customer.name}</td>
                        <td>{customer.ownerName}</td>
                        <td>{customer.status}</td>
                        <td>{geo.full}</td>
                        <td>{formatDate(customer.createdAt)}</td>
                        <td>{formatDate(customer.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            ) : null}
          </section>
          <section className="panel detail-grid">
            <h2 style={{ gridColumn: "1 / -1" }}>拟建客户摘要</h2>
            <div className="kv"><b>客户名称</b><span>{String(requestedPayload.payload.name || request.proposedCustomerName)}</span></div>
            <div className="kv"><b>客户类型</b><span>{String(requestedPayload.payload.customerType || "-")}</span></div>
            <div className="kv"><b>联系人数量</b><span>{requestedPayload.contacts.length}</span></div>
            <div className="kv"><b>主要产品需求</b><span>{String(requestedPayload.payload.purchaseNeed || "-")}</span></div>
          </section>
          {request.status === "pending" && canManage ? (
            <section className="panel stack">
              <h2>审核意见</h2>
              <p className="muted">确认同意该客户重复建档？系统将记录审核人、审核时间和审核原因。</p>
              <form className="stack" action={approveCustomerDuplicateReviewRequestAction.bind(null, request.id)}>
                <label>审核原因<textarea name="decisionNote" required placeholder="请说明为什么允许重复客户例外建档" /></label>
                <div><button type="submit">同意例外建档</button></div>
              </form>
              <form className="stack" action={rejectCustomerDuplicateReviewRequestAction.bind(null, request.id)}>
                <label>拒绝原因<textarea name="decisionNote" required placeholder="请说明拒绝原因" /></label>
                <div><button className="ghost" type="submit">拒绝</button></div>
              </form>
            </section>
          ) : null}
        </div>
      </KingaShell>
    );
  } catch (error) {
    return (
      <KingaShell user={user}>
        <Forbidden message={error instanceof Error ? error.message : "当前账号不能查看该重复客户审核。"} />
      </KingaShell>
    );
  }
}
