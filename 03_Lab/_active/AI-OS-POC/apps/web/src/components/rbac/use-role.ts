"use client"

import { useSession } from "next-auth/react"
import type { UserRole } from "@/lib/rbac"

export function useRole(): UserRole | undefined {
  const { data: session } = useSession()
  return session?.user?.role as UserRole | undefined
}
