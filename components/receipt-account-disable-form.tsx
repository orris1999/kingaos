"use client";

export function ReceiptAccountDisableForm({
  action,
  affectedCustomerCount
}: {
  action: (formData: FormData) => void | Promise<void>;
  affectedCustomerCount: number;
}) {
  const message =
    affectedCustomerCount > 0
      ? `该收款账号当前仍被 ${affectedCustomerCount} 个客户档案使用。停用后，这些客户档案会显示“默认收款账号已停用，请重新选择有效账号”。系统不会自动清空客户档案引用，也不会自动替换为其他账号。确认停用？`
      : "确认停用该收款账号？系统不会自动清空或替换任何客户档案引用。";

  return (
    <form
      className="form-grid"
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {affectedCustomerCount > 0 ? (
        <p className="warn-text" style={{ gridColumn: "1 / -1" }}>
          该收款账号当前仍被 {affectedCustomerCount} 个客户档案使用。停用后，相关客户会显示“默认收款账号已停用，请重新选择有效账号”。
        </p>
      ) : null}
      <label style={{ gridColumn: "1 / -1" }}>停用原因<textarea name="disabledReason" required /></label>
      <div><button className="ghost" type="submit">停用账号</button></div>
    </form>
  );
}
