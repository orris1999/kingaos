import type { CustomerFieldConfig, ExportCustomer, User, UserPermission } from "./domain-types";
import type { StorageLike } from "./storage";
import { STORAGE_KEYS } from "./storage";

export type KingaStore = ReturnType<typeof createKingaStore>;

function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(storage: StorageLike, key: string, value: T) {
  storage.setItem(key, JSON.stringify(value));
}

export function createKingaStore(storage: StorageLike) {
  return {
    storage,
    getUsers(): User[] {
      return readJson<User[]>(storage, STORAGE_KEYS.users, []);
    },
    saveUsers(users: User[]) {
      writeJson(storage, STORAGE_KEYS.users, users);
    },
    getCurrentUserId(): string | null {
      return storage.getItem(STORAGE_KEYS.currentUser);
    },
    setCurrentUserId(userId: string) {
      storage.setItem(STORAGE_KEYS.currentUser, userId);
    },
    clearCurrentUserId() {
      storage.removeItem(STORAGE_KEYS.currentUser);
    },
    getPermissions(): UserPermission[] {
      return readJson<UserPermission[]>(storage, STORAGE_KEYS.permissions, []);
    },
    savePermissions(permissions: UserPermission[]) {
      writeJson(storage, STORAGE_KEYS.permissions, permissions);
    },
    getCustomers(): ExportCustomer[] {
      return readJson<ExportCustomer[]>(storage, STORAGE_KEYS.customers, []);
    },
    saveCustomers(customers: ExportCustomer[]) {
      writeJson(storage, STORAGE_KEYS.customers, customers);
    },
    getCustomerFieldConfigs(): CustomerFieldConfig[] {
      return readJson<CustomerFieldConfig[]>(storage, STORAGE_KEYS.customerFieldConfigs, []);
    },
    saveCustomerFieldConfigs(fields: CustomerFieldConfig[]) {
      writeJson(storage, STORAGE_KEYS.customerFieldConfigs, fields);
    }
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}
