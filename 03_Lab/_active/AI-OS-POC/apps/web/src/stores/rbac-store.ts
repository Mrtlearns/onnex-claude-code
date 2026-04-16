import { create } from "zustand"
import { canAccess } from "@/lib/rbac"
import type { UserRole } from "@/lib/rbac"

interface RBACStore {
  role: UserRole | null
  setRole: (role: UserRole) => void
  can: (permission: string) => boolean
}

export const useRBACStore = create<RBACStore>((set, get) => ({
  role: null,
  setRole: (role) => set({ role }),
  can: (permission) => canAccess(get().role ?? undefined, permission),
}))
// IMPORTANT: DO NOT add zustand/middleware persist here
// persist reads localStorage -> hydration mismatch with SSR
// Populate role from useSession() in a Client Component on mount
