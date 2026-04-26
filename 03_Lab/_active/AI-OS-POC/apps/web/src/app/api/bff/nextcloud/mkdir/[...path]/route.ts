// apps/web/src/app/api/bff/nextcloud/mkdir/[...path]/route.ts
// BFF: create Nextcloud directory via WebDAV MKCOL

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const NC_URL = process.env.NEXTCLOUD_INTERNAL_URL ?? process.env.NEXTCLOUD_BASE_URL ?? "http://nextcloud-app:80"
const NC_USER = process.env.NEXTCLOUD_USER ?? process.env.NEXTCLOUD_ADMIN_USER ?? "ncadmin"
const NC_PASS = process.env.NEXTCLOUD_PASSWORD ?? process.env.NEXTCLOUD_ADMIN_PASSWORD ?? "ncadmin_dev_2024"
const NC_BASE = `${NC_URL}/remote.php/dav/files/${NC_USER}`

// Module-level cache: skip MKCOL if we already confirmed the dir exists this process lifetime
const confirmedDirs = new Set<string>()

export async function POST(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const basicAuth = Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")
  const fullPath = params.path.join("/")

  if (confirmedDirs.has(fullPath)) {
    return NextResponse.json({ ok: true, cached: true })
  }

  const resourcePath = params.path.map(encodeURIComponent).join("/")

  try {
    const res = await fetch(`${NC_BASE}/${resourcePath}`, {
      method: "MKCOL",
      headers: { Authorization: `Basic ${basicAuth}` },
    })
    // 405 = Method Not Allowed = directory already exists
    if (res.ok || res.status === 405) {
      confirmedDirs.add(fullPath)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false }, { status: res.status })
  } catch {
    return NextResponse.json({ error: "Nextcloud unavailable" }, { status: 503 })
  }
}
