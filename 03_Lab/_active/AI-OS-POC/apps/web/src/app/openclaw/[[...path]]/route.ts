/**
 * Full-path proxy for embedded OpenClaw Control UI.
 *
 * OpenClaw's web UI (port 47823) uses relative asset paths (./assets/...).
 * Next.js 308-redirects /openclaw/ → /openclaw (strips trailing slash), so the
 * browser resolves ./assets relative to /openclaw's parent (/) instead of
 * /openclaw/. Fix: inject <base href="/openclaw/"> into HTML responses so all
 * relative paths resolve correctly regardless of trailing-slash behavior.
 *
 * Port 47823 is NOT exposed to the host — must use internal Docker network name.
 *
 * Route: /openclaw/[[...path]]
 *   /openclaw/              → http://openclaw-runtime:47823/
 *   /openclaw/assets/x.js   → http://openclaw-runtime:47823/assets/x.js
 */

import { NextRequest, NextResponse } from "next/server"

const OPENCLAW_ORIGIN = process.env.OPENCLAW_INTERNAL_URL ?? "http://openclaw-runtime:47823"

const STRIPPED_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
])

async function proxy(req: NextRequest, pathSegments: string[]) {
  const upstreamPath = pathSegments.length > 0 ? "/" + pathSegments.join("/") : "/"
  const targetUrl = `${OPENCLAW_ORIGIN}${upstreamPath}${req.nextUrl.search}`

  try {
    const upstreamResp = await fetch(targetUrl, {
      method: req.method,
      headers: {
        host: new URL(OPENCLAW_ORIGIN).host,
        accept: req.headers.get("accept") ?? "*/*",
        "accept-language": req.headers.get("accept-language") ?? "en",
        "accept-encoding": "identity",
        cookie: req.headers.get("cookie") ?? "",
        ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      // @ts-expect-error
      duplex: ["GET", "HEAD"].includes(req.method) ? undefined : "half",
      redirect: "follow",
    })

    const resHeaders = new Headers()
    upstreamResp.headers.forEach((val, key) => {
      if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
        resHeaders.set(key, val)
      }
    })
    resHeaders.set("access-control-allow-origin", "*")

    // Inject <base href="/openclaw/"> so relative asset paths (./assets/...)
    // resolve correctly after Next.js strips the trailing slash.
    const contentType = resHeaders.get("content-type") ?? ""
    if (contentType.includes("text/html")) {
      const html = (await upstreamResp.text()).replace(
        "<head>",
        `<head><base href="/openclaw/">`,
      )
      resHeaders.set("content-type", "text/html; charset=utf-8")
      resHeaders.delete("content-length")
      return new NextResponse(html, { status: upstreamResp.status, headers: resHeaders })
    }

    return new NextResponse(upstreamResp.body, { status: upstreamResp.status, headers: resHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: "openclaw unreachable", detail: err.message }, { status: 502 })
  }
}

type Params = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, { params }: Params) {
  return proxy(req, (await params).path ?? [])
}
export async function POST(req: NextRequest, { params }: Params) {
  return proxy(req, (await params).path ?? [])
}
export async function PUT(req: NextRequest, { params }: Params) {
  return proxy(req, (await params).path ?? [])
}
export async function PATCH(req: NextRequest, { params }: Params) {
  return proxy(req, (await params).path ?? [])
}
export async function DELETE(req: NextRequest, { params }: Params) {
  return proxy(req, (await params).path ?? [])
}
