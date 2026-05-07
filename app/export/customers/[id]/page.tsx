import Link from "next/link";
import { CustomerDetailTabs } from "@/components/customer-detail-tabs";
import { CustomerAttachmentsPanel } from "@/components/customer-attachments-panel";
import { CustomerAttachmentDownloadButton } from "@/components/customer-oss-upload";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer, contactsForDisplay, getExportCustomerForActor, listCustomerFieldChangeHistoryForActor } from "@/lib/honoa/server/customers";
import { listCustomerFieldConfigsForActor } from "@/lib/honoa/server/field-config";
import { CUSTOMER_COMPANY_DUPLICATE_FIELD_KEYS, CUSTOMER_GEO_FIELD_KEYS, CUSTOMER_LEGACY_CONTACT_FIELD_KEYS, CUSTOMER_SYSTEM_FIELD_KEYS, customerCompanyDisplay, customerStatusCompatibilityOptions, customerStatusLabel, customerTypeValues } from "@/lib/honoa/shared/constants";
import type { CustomerFieldConfig } from "@/lib/honoa/shared/domain-types";
import { fieldOptionLabel } from "@/lib/honoa/shared/field-options";
import { displayFieldValue, fieldValueCompatibilityMessage, isSafeUrl, normalizeMultiValue, normalizeUrlFieldValue } from "@/lib/honoa/shared/field-values";
import { customerGeoDisplay } from "@/lib/honoa/shared/geo";
import type { CompanyReceiptAccount, Customer, CustomerAttachment, CustomerFieldChangeHistory } from "@prisma/client";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function fieldValue(customer: Customer & { attachments?: CustomerAttachment[] }, field: CustomerFieldConfig) {
  if (field.fieldKey === "status") return customerStatusLabel(rawFieldValue(customer, field) as string | null);
  if (field.fieldKey === "customerType") return <TagList values={customerTypeValues(customer)} />;
  const value = rawFieldValue(customer, field);
  if (field.fieldType === "multiselect") {
    return <TagList values={normalizeMultiValue(value).map((item) => fieldOptionLabel(field.options, item) || item)} />;
  }
  if (field.fieldType === "url") {
    const link = normalizeUrlFieldValue(value);
    if (!link) return "-";
    if (!isSafeUrl(link.url)) return <span className="warn-text">链接地址无效或不安全</span>;
    const external = /^https?:\/\//i.test(link.url);
    return <a href={link.url} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{link.label || link.url}</a>;
  }
  if (field.fieldType === "attachment") {
    const attachmentIds = normalizeMultiValue(value);
    const attachments = (customer.attachments || []).filter((attachment) =>
      !attachment.deletedAt &&
      (attachment.fieldKey === field.fieldKey || attachmentIds.includes(attachment.id))
    );
    if (attachments.length === 0) return "-";
    return (
      <div className="inline-stack">
        {attachments.map((attachment) => (
          <span className="tag" key={attachment.id}>
            {attachment.attachmentName}
            <CustomerAttachmentDownloadButton customerId={customer.id} attachmentId={attachment.id} />
          </span>
        ))}
      </div>
    );
  }
  return displayFieldValue(value, field.fieldType, field.options);
}

function rawFieldValue(customer: Customer, field: CustomerFieldConfig) {
  if (field.fieldKey === "createdAt") return formatDate(customer.createdAt);
  if (field.fieldKey === "updatedAt") return formatDate(customer.updatedAt);
  if (field.fieldKey === "ownerUserId") return customer.ownerName;
  if (CUSTOMER_SYSTEM_FIELD_KEYS.has(field.fieldKey)) {
    return (customer as unknown as Record<string, unknown>)[field.fieldKey];
  }
  const customFields = customer.customFields as Record<string, unknown>;
  return customFields[field.fieldKey];
}

function TagList({ values }: { values: string[] }) {
  if (values.length === 0) return "-";
  return <span className="inline-stack">{values.map((value) => <span className="tag" key={value}>{value}</span>)}</span>;
}

function ReceiptAccountDetail({ account }: { account?: CompanyReceiptAccount | null }) {
  if (!account) return <p className="muted">暂无默认收款方案</p>;
  return (
    <div className="detail-grid readonly-panel">
      <div className="kv" style={{ gridColumn: "1 / -1" }}>
        <b>只读说明</b><span className="muted">财务维护，业务只读。</span>
      </div>
      {!account.isActive ? (
        <div className="kv" style={{ gridColumn: "1 / -1" }}>
          <b>状态提醒</b><span className="warn-text">当前默认收款账号已停用，请重新选择有效账号。</span>
        </div>
      ) : null}
      <div className="kv"><b>方案名称</b><span>{account.displayName}</span></div>
      <div className="kv"><b>币种</b><span>{account.currency}</span></div>
      <div className="kv"><b>开户行</b><span>{account.bankName}</span></div>
      <div className="kv"><b>账号</b><span>{account.accountNo}</span></div>
      <div className="kv"><b>SWIFT CODE</b><span>{account.swiftCode || "-"}</span></div>
      <div className="kv"><b>状态</b><span>{account.isActive ? "有效" : "已停用"}</span></div>
    </div>
  );
}

function ChangeHistoryList({ histories }: { histories: CustomerFieldChangeHistory[] }) {
  if (histories.length === 0) return <p className="muted">暂无修改历史</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>修改时间</th><th>修改人</th><th>字段</th><th>原值</th><th>新值</th><th>来源</th></tr>
        </thead>
        <tbody>
          {histories.map((history) => (
            <tr key={history.id}>
              <td>{formatDate(history.changedAt)}</td>
              <td>{history.changedByName || "-"}</td>
              <td>{history.fieldLabel}</td>
              <td>{history.oldDisplayValue || "未填写"}</td>
              <td>{history.newDisplayValue || "未填写"}</td>
              <td>{history.source === "receipt_account_select" ? "默认收款方案" : "客户编辑"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  try {
    const customer = await getExportCustomerForActor(user, id);
    const [fields, histories] = await Promise.all([
      listCustomerFieldConfigsForActor(undefined, false),
      listCustomerFieldChangeHistoryForActor(user, id)
    ]);
    const tabParams = await searchParams;
    const initialTabIndex = tabParams?.tab === "history" ? 5 : 0;
    const contacts = contactsForDisplay(customer);
    const canEdit = canEditCustomerServer(user, customer);
    const geo = customerGeoDisplay(customer);
    const fieldsForGroup = (group: CustomerFieldConfig["fieldGroup"]) =>
      fields.filter((field) =>
        field.fieldGroup === group &&
        !CUSTOMER_LEGACY_CONTACT_FIELD_KEYS.has(field.fieldKey) &&
        !CUSTOMER_GEO_FIELD_KEYS.has(field.fieldKey) &&
        !CUSTOMER_COMPANY_DUPLICATE_FIELD_KEYS.has(field.fieldKey)
      );
    const renderFields = (group: CustomerFieldConfig["fieldGroup"]) => {
      const groupFields = fieldsForGroup(group);
      if (groupFields.length === 0) return <p className="muted">暂无信息</p>;
      return (
        <div className="detail-grid">
          {groupFields.map((field) => (
            <div className="kv" key={field.id}>
              <b>{field.fieldLabel}</b>
              <span>{fieldValue(customer, field)}</span>
              {fieldValueCompatibilityMessage(rawFieldValue(customer, field), field.fieldType, field.fieldKey === "status" ? customerStatusCompatibilityOptions(field.options) : field.options) ? (
                <span className="tiny warn-text">{fieldValueCompatibilityMessage(rawFieldValue(customer, field), field.fieldType, field.fieldKey === "status" ? customerStatusCompatibilityOptions(field.options) : field.options)}</span>
              ) : null}
            </div>
          ))}
        </div>
      );
    };
    return (
      <KingaShell user={user}>
        <div className="stack">
          <div className="split">
            <div>
              <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / 客户详情</div>
              <h1>{customerCompanyDisplay(customer)}</h1>
              <p className="actions">
                <span className="tag">客户编号：{customer.customerCode}</span>
                {customer.duplicateApprovalStatus === "approved_duplicate" ? <span className="tag warn">重复客户例外</span> : null}
              </p>
            </div>
            <div className="actions">
              {canEdit ? <Link className="button" href={`/export/customers/${customer.id}/edit`}>编辑客户</Link> : null}
              <Link className="button ghost" href="/export/customers">返回列表</Link>
            </div>
          </div>
          <section className="panel detail-grid">
            <div className="kv"><b>负责人</b><span>{customer.ownerName}</span></div>
            <div className="kv"><b>创建时间</b><span>{formatDate(customer.createdAt)}</span></div>
            <div className="kv"><b>更新时间</b><span>{formatDate(customer.updatedAt)}</span></div>
            {customer.duplicateApprovalStatus === "approved_duplicate" ? (
              <>
                <div className="kv"><b>重复客户审核人</b><span>{customer.duplicateApprovedByName || "-"}</span></div>
                <div className="kv"><b>重复客户审核时间</b><span>{customer.duplicateApprovedAt ? formatDate(customer.duplicateApprovedAt) : "-"}</span></div>
                <div className="kv"><b>重复客户审核原因</b><span>{customer.duplicateApprovalReason || "-"}</span></div>
              </>
            ) : null}
          </section>
          <CustomerDetailTabs initialTabIndex={initialTabIndex}>
            <section className="panel stack">
              <h2>基础信息</h2>
              <div className="detail-grid">
                <div className="kv"><b>地址</b><span>{geo.full}</span></div>
              </div>
              {renderFields("基础信息")}
            </section>
            <section className="panel stack">
              <h2>联系人信息</h2>
              {contacts.length === 0 ? <p className="muted">暂无联系人</p> : null}
              {contacts.map((contact) => (
                <div className="subpanel detail-grid" key={contact.id}>
                  <div className="kv">
                    <b>联系人姓名</b>
                    <span>{contact.name} {contact.isPrimary ? <span className="tag ok">主要联系人</span> : null}</span>
                  </div>
                  <div className="kv"><b>职位</b><span>{contact.title || "-"}</span></div>
                  <div className="kv"><b>电话</b><span>{contact.phone || "-"}</span></div>
                  <div className="kv"><b>邮箱</b><span>{contact.email || "-"}</span></div>
                  <div className="kv"><b>WhatsApp / 微信</b><span>{contact.wechatOrWhatsapp || "-"}</span></div>
                  <div className="kv"><b>备注</b><span>{contact.notes || "-"}</span></div>
                </div>
              ))}
              {renderFields("联系人信息")}
            </section>
            <section className="panel stack">
              <h2>公司信息</h2>
              {renderFields("公司信息")}
            </section>
            <section className="panel stack">
              <h2>合作信息</h2>
              {renderFields("合作信息")}
              <section className="subpanel stack">
                <h3>默认收款方案</h3>
                <ReceiptAccountDetail account={customer.defaultReceiptAccount} />
              </section>
            </section>
            <section className="stack">
              <section className="panel stack">
                <h2>备注 / 特殊提醒</h2>
                {renderFields("备注 / 特殊提醒")}
              </section>
              <CustomerAttachmentsPanel
                customerId={customer.id}
                attachments={(customer.attachments || []) as CustomerAttachment[]}
                editable={canEdit}
              />
            </section>
            <section className="panel stack" id="history">
              <h2>修改历史</h2>
              <p className="muted">仅内部可见，按客户查看权限控制。记录客户关键字段、自定义字段和默认收款方案的变化。</p>
              <ChangeHistoryList histories={histories} />
            </section>
            <section className="panel stack">
              <h2>操作记录</h2>
              <p className="muted">操作记录已在 AuditLog 中记录，详情页完整时间线后续开放。</p>
            </section>
          </CustomerDetailTabs>
        </div>
      </KingaShell>
    );
  } catch (error) {
    return (
      <KingaShell user={user}>
        <Forbidden message={error instanceof Error ? error.message : "当前账号不能查看该客户。"} />
      </KingaShell>
    );
  }
}
