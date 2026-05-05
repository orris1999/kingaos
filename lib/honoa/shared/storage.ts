export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const STORAGE_KEYS = {
  users: "kingaos.users",
  currentUser: "kingaos.currentUser",
  permissions: "kingaos.permissions",
  customers: "kingaos.export.customers",
  customerFieldConfigs: "kingaos.export.customerFieldConfigs"
} as const;

export function createMemoryStorage(initial?: Record<string, string>): StorageLike {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

export function createBrowserStorage(): StorageLike {
  if (typeof window === "undefined") return createMemoryStorage();
  return window.localStorage;
}
