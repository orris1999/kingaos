export type CustomerContactDraft = {
  id?: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  wechatOrWhatsapp?: string;
  isPrimary?: boolean;
  notes?: string;
  sortOrder?: number;
};

export type CustomerAttachmentDraft = {
  id?: string;
  attachmentName: string;
  attachmentType?: string;
  fileUrl?: string;
  description?: string;
};

export function normalizeCustomerContacts(contacts: CustomerContactDraft[]) {
  const normalized = contacts
    .map((contact, index) => ({
      ...contact,
      name: contact.name.trim(),
      title: contact.title?.trim() || "",
      phone: contact.phone?.trim() || "",
      email: contact.email?.trim() || "",
      wechatOrWhatsapp: contact.wechatOrWhatsapp?.trim() || "",
      notes: contact.notes?.trim() || "",
      sortOrder: Number.isFinite(contact.sortOrder) ? Number(contact.sortOrder) : index
    }))
    .filter((contact) =>
      [contact.name, contact.title, contact.phone, contact.email, contact.wechatOrWhatsapp, contact.notes].some(Boolean)
    );

  const primaryIndex = normalized.findIndex((contact) => contact.isPrimary);
  const effectivePrimaryIndex = normalized.length === 1 ? 0 : primaryIndex;
  return normalized.map((contact, index) => ({
    ...contact,
    isPrimary: effectivePrimaryIndex >= 0 && index === effectivePrimaryIndex
  }));
}

export function markPrimaryContact<T extends { id: string; isPrimary: boolean }>(contacts: T[], contactId: string) {
  return contacts.map((contact) => ({ ...contact, isPrimary: contact.id === contactId }));
}

export function normalizeCustomerAttachment(input: CustomerAttachmentDraft) {
  return {
    ...input,
    attachmentName: input.attachmentName.trim(),
    attachmentType: input.attachmentType?.trim() || "其他",
    fileUrl: input.fileUrl?.trim() || "",
    description: input.description?.trim() || ""
  };
}

export function softDeleteAttachment<T extends { deletedAt: string | null }>(attachment: T, deletedAt: string): Omit<T, "deletedAt"> & { deletedAt: string } {
  return { ...attachment, deletedAt };
}
