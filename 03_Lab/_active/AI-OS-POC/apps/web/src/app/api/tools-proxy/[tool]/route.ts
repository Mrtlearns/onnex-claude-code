/**
 * Reverse proxy for embedded tools (n8n, Temporal UI, OpenClaw).
 * Strips X-Frame-Options and restrictive CSP so they render in our iframe.
 * Rewrites HTML base hrefs so relative paths resolve correctly.
 *
 * Route: GET/POST /api/tools-proxy/[tool]?path=...
 */

import { NextRequest, NextResponse } from "next/server"

const TOOL_ORIGINS: Record<string, string> = {
  n8n:      "http://10.10.110.31:5678",
  temporal: "http://10.10.110.31:8080",
  openclaw: "http://10.10.110.31:8888",
}

const STRIPPED_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-content-type-options",
])

async function proxy(req: NextRequest, tool: string) {
  const origin = TOOL_ORIGINS[tool]
  if (!origin) return NextResponse.json({ error: "unknown tool" }, { status: 404 })

  // Reconstruct the downstream URL from the ?path= param or just "/"
  const pathParam = req.nextUrl.searchParams.get("path") ?? "/"
  const qs = new URLSearchParams(req.nextUrl.searchParams)
  qs.delete("path")
  const qsStr = qs.toString()
  const targetUrl = `${origin}${pathParam}${qsStr ? "?" + qsStr : ""}`

  try {
    const upstreamResp = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "host": new URL(origin).host,
        "accept": req.headers.get("accept") ?? "*/*",
        "accept-language": req.headers.get("accept-language") ?? "en-US,en",
        "cookie": req.headers.get("cookie") ?? "",
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
    })

    // Clone and sanitise response headers
    const resHeaders = new Headers()
    upstreamResp.headers.forEach((val, key) => {
      if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
        resHeaders.set(key, val)
      }
    })
    // Allow framing from any same-origin page
    resHeaders.delete("x-frame-options")
    resHeaders.set("access-control-allow-origin", "*")

    const contentType = resHeaders.get("content-type") ?? ""

    // Rewrite HTML to fix absolute-path asset references
    if (contentType.includes("text/html")) {
      let html = await upstreamResp.text()
      const base = `/api/tools-proxy/${tool}?path=`
      // Inject <base> tag so relative paths hit the proxy
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1><base href="/api/tools-proxy/${tool}?path=/">`,
      )
      resHeaders.set("content-type", "text/html; charset=utf-8")
      resHeaders.delete("content-length")
      return new NextResponse(html, { status: upstreamResp.status, headers: resHeaders })
    }

    return new NextResponse(upstreamResp.body, {
      status: upstreamResp.status,
      headers: resHeaders,
    })
  } catch (err: any) {
    return NextResponse.json({ error: "upstream unreachable", detail: err.message }, { status: 502 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  return proxy(req, tool)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  return proxy(req, tool)
}
