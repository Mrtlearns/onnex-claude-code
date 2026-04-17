// apps/web/src/app/api/bff/nextcloud/[...path]/route.ts
// BFF proxy: GET Nextcloud WebDAV at arbitrary path — directory listing (PROPFIND) or file stream (GET)
// POST: create a public share link via OCS Sharing API
// Credentials (NEXTCLOUD_PASSWORD) stay server-side; browser receives XML or file bytes

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const NC_URL = process.env.NEXTCLOUD_INTERNAL_URL ?? process.env.NEXTCLOUD_BASE_URL ?? "http://nextcloud-app:80"
const NC_USER = process.env.NEXTCLOUD_USER ?? process.env.NEXTCLOUD_ADMIN_USER ?? "ncadmin"
const NC_PASS = process.env.NEXTCLOUD_PASSWORD ?? process.env.NEXTCLOUD_ADMIN_PASSWORD ?? "ncadmin_dev_2024"
const NC_BASE = `${NC_URL}/remote.php/dav/files/${NC_USER}`

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const basicAuth = Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")
  const resourcePath = params.path.map(encodeURIComponent).join("/")

  // Determine if this is a directory listing or a file download based on trailing slash
  // or Content-Type hint from the request. Default to PROPFIND for directories.
  const isDownload = request.nextUrl.searchParams.get("download") === "1"
  const isConvertPdf = request.nextUrl.searchParams.get("convert") === "pdf"

  if (isConvertPdf) {
    // Fetch file from Nextcloud then convert to PDF via Collabora's convert-to API
    const collaboraUrl = process.env.COLLABORA_INTERNAL_URL ?? "http://collabora:9980"
    try {
      const ncRes = await fetch(`${NC_BASE}/${resourcePath}`, {
        headers: { Authorization: `Basic ${basicAuth}` },
      })
      if (!ncRes.ok) return new NextResponse("Not found", { status: ncRes.status })

      const fileBuffer = await ncRes.arrayBuffer()
      const fileName = params.path[params.path.length - 1]

      const formData = new FormData()
      formData.append("data", new Blob([fileBuffer]), fileName)

      const convertRes = await fetch(`${collaboraUrl}/cool/convert-to/pdf`, {
        method: "POST",
        body: formData,
      })

      if (!convertRes.ok) {
        // Fall back to direct download if conversion fails
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${fileName}"`,
          },
        })
      }

      return new NextResponse(convertRes.body, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}.pdf"`,
        },
      })
    } catch {
      return new NextResponse("Conversion unavailable", { status: 503 })
    }
  }

  if (isDownload) {
    // Stream file content to browser (e.g., image preview, PDF download)
    try {
      const res = await fetch(`${NC_BASE}/${resourcePath}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      })

      if (!res.ok) {
        return new NextResponse("Not found", { status: res.status })
      }

      return new NextResponse(res.body, {
        status: 200,
        headers: {
          "Content-Type":
            res.headers.get("Content-Type") ?? "application/octet-stream",
          "Content-Disposition": `inline; filename="${params.path[params.path.length - 1]}"`,
        },
      })
    } catch {
      return new NextResponse("Nextcloud unavailable", { status: 503 })
    }
  }

  // Directory listing via WebDAV PROPFIND
  try {
    const res = await fetch(`${NC_BASE}/${resourcePath}`, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Depth: "1",
        "Content-Type": "application/xml",
      },
    })

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

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const basicAuth = Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")
  const filePath = "/" + params.path.join("/")

  try {
    const res = await fetch(`${NC_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        "OCS-APIREQUEST": "true",
      },
      body: new URLSearchParams({ path: filePath, shareType: "3", permissions: "1" }),
    })

    const xml = await res.text()
    const token = xml.match(/<token>(.*?)<\/token>/)?.[1]
    if (!token) {
      return NextResponse.json({ error: "Share creation failed" }, { status: 500 })
    }

    const publicBase = process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? NC_URL
    return NextResponse.json({ url: `${publicBase}/s/${token}` })
  } catch {
    return NextResponse.json({ error: "Nextcloud unavailable" }, { status: 503 })
  }
}
