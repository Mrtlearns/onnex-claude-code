// apps/web/src/app/(portal)/page.tsx
// /portal index — redirects to /portal/projects

import { redirect } from "next/navigation"

export default function PortalPage() {
  redirect("/portal/projects")
}
