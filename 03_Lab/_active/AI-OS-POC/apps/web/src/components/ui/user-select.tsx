"use client"
// Reusable people-picker backed by GET /api/bff/staff
// Usage: <UserSelect value={userId} onChange={setUserId} placeholder="Unassigned" />

import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { StaffMember } from "@/types/api"

const NONE = "__none__"

interface UserSelectProps {
  value?: string | null
  onChange: (userId: string | undefined) => void
  placeholder?: string
  includeNone?: boolean
  disabled?: boolean
  className?: string
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function UserSelect({
  value,
  onChange,
  placeholder = "Unassigned",
  includeNone = true,
  disabled = false,
  className,
}: UserSelectProps) {
  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: () => fetch("/api/bff/staff").then((r) => r.json()),
    staleTime: 120_000,
  })

  const selected = staff.find((s) => s.user_id === value)

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? undefined : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        {selected ? (
          <span className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={selected.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {initials(selected.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selected.display_name}</span>
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {includeNone && (
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">{placeholder}</span>
          </SelectItem>
        )}
        {staff.map((s) => (
          <SelectItem key={s.user_id} value={s.user_id}>
            <span className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={s.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {initials(s.display_name)}
                </AvatarFallback>
              </Avatar>
              <span>
                {s.display_name}
                {s.job_title && (
                  <span className="text-muted-foreground text-xs ml-1">
                    · {s.job_title}
                  </span>
                )}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
