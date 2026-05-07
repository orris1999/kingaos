"use client";

import { useMemo, useState } from "react";

export type CustomerMultiselectOption = {
  value: string;
  label: string;
  internalNote?: string;
};

export function CustomerMultiselectField({
  name,
  options,
  selectedValues,
  required,
  placeholder = "请选择",
  testId
}: {
  name: string;
  options: CustomerMultiselectOption[];
  selectedValues: string[];
  required?: boolean;
  placeholder?: string;
  testId?: string;
}) {
  const [selected, setSelected] = useState(selectedValues);
  const selectedOptions = useMemo(
    () => options.filter((option) => selected.includes(option.value)),
    [options, selected]
  );

  function toggle(value: string, checked: boolean) {
    setSelected((current) => {
      if (checked) return Array.from(new Set([...current, value]));
      return current.filter((item) => item !== value);
    });
  }

  return (
    <div className="multi-select" data-testid={testId}>
      <details className="multi-select-dropdown">
        <summary className={required ? "multi-select-summary required-control" : "multi-select-summary"}>
          {selectedOptions.length === 0 ? (
            <span className="muted">{placeholder}</span>
          ) : (
            <span className="tag-list-nowrap">
              {selectedOptions.slice(0, 3).map((option) => <span className="tag" key={option.value}>{option.label}</span>)}
              {selectedOptions.length > 3 ? <span className="tag">+{selectedOptions.length - 3}</span> : null}
            </span>
          )}
        </summary>
        <div className="multi-select-menu">
          {options.map((option) => (
            <label className="multi-option" key={option.value}>
              <input
                checked={selected.includes(option.value)}
                name={name}
                onChange={(event) => toggle(option.value, event.target.checked)}
                type="checkbox"
                value={option.value}
              />
              <span>
                {option.label}
                {option.internalNote ? <small className="tiny muted"> {option.internalNote}</small> : null}
              </span>
            </label>
          ))}
        </div>
      </details>
      {required ? <span className="tiny muted">请选择至少一个客户类型。</span> : null}
    </div>
  );
}
