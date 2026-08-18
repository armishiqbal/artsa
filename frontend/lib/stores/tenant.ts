import { create } from "zustand";

/**
 * Active tenant selection — WS-3.1 Phase 3.
 *
 * Every API call carries the selected tenant as the X-Tenant-ID header (see
 * lib/api.ts buildHeaders), so the whole UI filters to one org at a time.
 */
interface TenantState {
  tenantId: string;
  setTenant: (tenantId: string) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenantId: "default_org",
  setTenant: (tenantId) => set({ tenantId: tenantId || "default_org" }),
}));
