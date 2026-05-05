"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

const TYPE_CHANGE_WARNING = [
  "修改字段类型可能影响历史客户档案中该字段的显示和校验。",
  "系统不会自动删除历史值。",
  "无法转换的历史值会保留原值，并在编辑时提示重新确认。",
  "是否继续？"
].join("\n");

export function CustomerFieldConfigForm({
  action,
  children,
  confirmTypeChange = false
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmTypeChange?: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const confirmedRef = useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!confirmTypeChange) return;
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }
    const form = event.currentTarget;
    const initialType = form.querySelector<HTMLInputElement>('input[name="initialFieldType"]')?.value;
    const fieldType = form.querySelector<HTMLSelectElement>('select[name="fieldType"]')?.value;
    if (initialType && fieldType && initialType !== fieldType) {
      event.preventDefault();
      setShowConfirm(true);
    }
  }

  return (
    <>
      <form ref={formRef} className="form-grid" action={action} onSubmit={onSubmit}>
        {children}
      </form>
      {showConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="确认修改字段类型">
          <div className="modal-card stack">
            <h2>确认修改字段类型</h2>
            <p className="muted">{TYPE_CHANGE_WARNING}</p>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setShowConfirm(false)}>取消</button>
              <button
                type="button"
                onClick={() => {
                  confirmedRef.current = true;
                  setShowConfirm(false);
                  formRef.current?.requestSubmit();
                }}
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
