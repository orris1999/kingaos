"use client";

import * as React from "react";

const DETAIL_TABS = ["基础信息", "联系人", "公司信息", "合作信息", "附件与备注", "修改历史", "操作记录"];

export function CustomerDetailTabs({ children, initialTabIndex = 0 }: { children: React.ReactNode; initialTabIndex?: number }) {
  const [active, setActive] = React.useState(initialTabIndex);
  const panes = React.Children.toArray(children);
  return (
    <div className="stack">
      <nav className="stepbar" aria-label="客户详情分区">
        {DETAIL_TABS.map((label, index) => (
          <button className={active === index ? "step active" : "step"} key={label} type="button" onClick={() => setActive(index)}>
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="wizard-frame">
        {panes.map((pane, index) => (
          <div className={active === index ? "wizard-pane active" : "wizard-pane"} key={DETAIL_TABS[index]}>
            {pane}
          </div>
        ))}
      </div>
    </div>
  );
}
