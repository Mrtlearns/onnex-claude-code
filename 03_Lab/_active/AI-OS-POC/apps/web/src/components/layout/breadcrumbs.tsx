"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { NAV_ITEMS } from "@/components/layout/sidebar"
import { ChevronRight, Home } from "lucide-react"

function labelFromHref(href: string): string {
  const navItem = NAV_ITEMS.find((item) => item.href === href)
  if (navItem) return navItem.label
  return href.slice(1).charAt(0).toUpperCase() + href.slice(2).replace(/-/g, " ")
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return (
      <nav className="flex items-center text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
      </nav>
    )
  }

  const crumbs = segments.map((_, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/")
    const label = labelFromHref("/" + segments[idx])
    return { href, label }
  })

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground">
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={crumb.href}>
          <Separator orientation="vertical" className="h-4" />
          <ChevronRight className="h-3 w-3" />
          {idx === crumbs.length - 1 ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
