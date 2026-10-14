import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 3200;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (newToast) => {
    set((state) => {
      // Deduplicate: If an active toast with the same title already exists, don't spam
      const alreadyExists = state.toasts.some(
        (t) => t.title.toLowerCase() === newToast.title.toLowerCase()
      );
      if (alreadyExists) {
        return state;
      }

      const id = crypto.randomUUID();
      const updated = [...state.toasts, { ...newToast, id }].slice(-MAX_TOASTS);

      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, TOAST_DURATION_MS);

      return { toasts: updated };
    });
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}));

export function toast(title: string, options?: { description?: string; variant?: ToastVariant }) {
  useToastStore.getState().add({
    title,
    description: options?.description,
    variant: options?.variant ?? "default",
  });
}
