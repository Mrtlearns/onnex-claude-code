// apps/web/src/app/api/bff/nextcloud/route.ts
// BFF proxy: GET root folder listing from Nextcloud WebDAV
// Credentials (NEXTCLOUD_PASSWORD) stay server-side; browser receives raw WebDAV XML

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const NC_URL = process.env.NEXTCLOUD_INTERNAL_URL ?? process.env.NEXTCLOUD_BASE_URL ?? "http://nextcloud-app:80"
const NC_USER = process.env.NEXTCLOUD_USER ?? process.env.NEXTCLOUD_ADMIN_USER ?? "ncadmin"
const NC_PASS = process.env.NEXTCLOUD_PASSWORD ?? process.env.NEXTCLOUD_ADMIN_PASSWORD ?? "ncadmin_dev_2024"
const NC_BASE = `${NC_URL}/remote.php/dav/files/${NC_USER}`

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const basicAuth = Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")

  try {
    const res = await fetch(`${NC_BASE}/`, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Depth: "1",
        "Content-Type": "application/xml",
      },
    })

    // Return raw WebDAV XML — the Documents UI will parse it client-side
    const xml = await res.text()
    return new NextResponse(xml, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/xml",
      },
    })
  } catch {
    return NextResponse.json({ error: "Nextcloud unavailable" }, { status: 503 })
  }
}
