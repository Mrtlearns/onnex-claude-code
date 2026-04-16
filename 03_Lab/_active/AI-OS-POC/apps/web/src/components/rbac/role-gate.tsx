"use client"

import { useSession } from "next-auth/react"
import { canAccess } from "@/lib/rbac"
import type { UserRole } from "@/lib/rbac"

interface RoleGateProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGate({ permission, children, fallback = null }: RoleGateProps) {
  const { data: session } = useSession()
  const role = session?.user?.role as UserRole | undefined
  if (!canAccess(role, permission)) return <>{fallback}</>
  return <>{children}</>
}
