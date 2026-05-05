"use client";

import * as React from "react";

const STEP_LABELS = ["基础信息", "联系人信息", "公司信息", "合作信息", "附件与备注", "确认并保存"];

export function CustomerFormWizard({ children, isEdit }: { children: React.ReactNode; isEdit: boolean }) {
  const [step, setStep] = React.useState(0);
  const stepRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const panes = React.Children.toArray(children);

  function canLeaveCurrentStep() {
    const current = stepRefs.current[step];
    if (!current) return true;
    const controls = Array.from(current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  }

  function go(nextStep: number) {
    if (nextStep > step + 1) return;
    if (nextStep > step && !canLeaveCurrentStep()) return;
    setStep(nextStep);
  }

  return (
    <div className="stack">
      <nav className="stepbar" aria-label="客户档案填写步骤">
        {STEP_LABELS.map((label, index) => (
          <button
            className={index === step ? "step active" : index < step ? "step done" : "step"}
            key={label}
            type="button"
            disabled={index > step + 1}
            onClick={() => go(index)}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="wizard-frame">
        {panes.map((pane, index) => (
          <div
            aria-hidden={step !== index}
            className={step === index ? "wizard-pane active" : "wizard-pane"}
            key={STEP_LABELS[index]}
            ref={(node) => {
              stepRefs.current[index] = node;
            }}
          >
            {pane}
          </div>
        ))}
      </div>
      <div className="actions">
        {step > 0 ? <button type="button" className="ghost" onClick={() => go(step - 1)}>上一步</button> : null}
        {step < STEP_LABELS.length - 1 ? <button type="button" onClick={() => go(step + 1)}>下一步</button> : <button type="submit">{isEdit ? "保存修改" : "保存客户"}</button>}
      </div>
    </div>
  );
}
