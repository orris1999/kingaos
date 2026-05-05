"use client";

import * as React from "react";

type ContactInput = {
  id?: string;
  clientKey?: string;
  name?: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  wechatOrWhatsapp?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
  sortOrder?: number;
};

function blankContact(sortOrder: number): ContactInput {
  return {
    clientKey: `contact_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: "",
    title: "",
    phone: "",
    email: "",
    wechatOrWhatsapp: "",
    isPrimary: false,
    notes: "",
    sortOrder
  };
}

function withClientKeys(contacts: ContactInput[]) {
  return contacts.map((contact, index) => ({ ...contact, clientKey: contact.clientKey || contact.id || `contact-${index}` }));
}

export function CustomerContactEditor({ contacts }: { contacts: ContactInput[] }) {
  const [items, setItems] = React.useState<ContactInput[]>(contacts.length > 0 ? withClientKeys(contacts) : [blankContact(0)]);

  function addContact() {
    setItems((current) => [...current, blankContact(current.length)]);
  }

  function removeContact(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function setPrimary(index: number) {
    setItems((current) => current.map((contact, itemIndex) => ({ ...contact, isPrimary: itemIndex === index })));
  }

  function updateContact(index: number, key: keyof ContactInput, value: string) {
    setItems((current) => current.map((contact, itemIndex) => (itemIndex === index ? { ...contact, [key]: value } : contact)));
  }

  return (
    <section className="panel stack">
      <div className="split">
        <div>
          <h2>联系人信息</h2>
          <p className="muted">客户可以没有联系人，也可以添加多个联系人。</p>
        </div>
        <button type="button" className="ghost" onClick={addContact}>添加联系人</button>
      </div>
      <input type="hidden" name="contactCount" value={items.length} />
      {items.length === 0 ? <p className="muted">暂无联系人，可点击“添加联系人”。</p> : null}
      {items.map((contact, index) => (
        <div className="subpanel stack" key={contact.clientKey}>
          <input type="hidden" name={`contact_${index}_id`} value={contact.id || ""} />
          <input type="hidden" name={`contact_${index}_sortOrder`} value={index} />
          <div className="split">
            <h3>联系人 {index + 1}</h3>
            <button type="button" className="ghost danger-text" onClick={() => removeContact(index)}>删除联系人</button>
          </div>
          <div className="form-grid">
            <label>联系人姓名<input name={`contact_${index}_name`} value={contact.name || ""} onChange={(event) => updateContact(index, "name", event.target.value)} /></label>
            <label>职位<input name={`contact_${index}_title`} value={contact.title || ""} onChange={(event) => updateContact(index, "title", event.target.value)} /></label>
            <label>电话<input name={`contact_${index}_phone`} value={contact.phone || ""} onChange={(event) => updateContact(index, "phone", event.target.value)} /></label>
            <label>邮箱<input name={`contact_${index}_email`} type="email" value={contact.email || ""} onChange={(event) => updateContact(index, "email", event.target.value)} /></label>
            <label>WhatsApp / 微信<input name={`contact_${index}_wechatOrWhatsapp`} value={contact.wechatOrWhatsapp || ""} onChange={(event) => updateContact(index, "wechatOrWhatsapp", event.target.value)} /></label>
            <label className="checkrow">
              <input
                type="checkbox"
                name={`contact_${index}_isPrimary`}
                value="1"
                checked={Boolean(contact.isPrimary)}
                onChange={() => setPrimary(index)}
              />
              <span>主要联系人</span>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>备注<textarea name={`contact_${index}_notes`} value={contact.notes || ""} onChange={(event) => updateContact(index, "notes", event.target.value)} /></label>
          </div>
        </div>
      ))}
    </section>
  );
}
