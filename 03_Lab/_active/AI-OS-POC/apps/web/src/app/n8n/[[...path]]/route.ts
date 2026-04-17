/**
 * Full-path proxy for embedded n8n.
 *
 * Requires n8n to be started with N8N_PATH="/n8n/" so it prefixes ALL asset
 * hrefs with /n8n/ (e.g. /assets/xxx.js → /n8n/assets/xxx.js).
 *
 * This route receives those /n8n/* requests, strips the /n8n prefix, and
 * forwards them to the n8n container — stripping X-Frame-Options and CSP
 * headers so the browser allows iframe embedding.
 *
 * Route: /n8n/[[...path]]
 *   /n8n/           → http://n8n:5678/
 *   /n8n/assets/x   → http://n8n:5678/assets/x
 *   /n8n/rest/wf    → http://n8n:5678/rest/wf
 */

import { NextRequest, NextResponse } from "next/server"

const N8N_ORIGIN = process.env.N8N_INTERNAL_URL ?? "http://n8n:5678"

const STRIPPED_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-content-type-options",
])

async function proxy(req: NextRequest, pathSegments: string[]) {
  // pathSegments is everything after /n8n/ — forward to n8n root
  const upstreamPath = pathSegments.length > 0 ? "/" + pathSegments.join("/") : "/"
  const qs = req.nextUrl.search // includes leading "?"
  const targetUrl = `${N8N_ORIGIN}${upstreamPath}${qs}`

  const isBodyMethod = !["GET", "HEAD"].includes(req.method)

  try {
    const upstreamResp = await fetch(targetUrl, {
      method: req.method,
      headers: {
        host: new URL(N8N_ORIGIN).host,
        accept: req.headers.get("accept") ?? "*/*",
        "accept-language": req.headers.get("accept-language") ?? "en",
        "accept-encoding": "identity", // avoid brotli/gzip encoding issues
        cookie: req.headers.get("cookie") ?? "",
        ...(req.headers.get("content-type") ? { "content-type": req.headers.get("content-type")! } : {}),
        ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
      },
      body: isBodyMethod ? req.body : undefined,
      // @ts-expect-error — duplex required for streaming body in Node.js fetch
      duplex: isBodyMethod ? "half" : undefined,
      redirect: "follow",
    })

    const resHeaders = new Headers()
    upstreamResp.headers.forEach((val, key) => {
      if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
        resHeaders.set(key, val)
      }
    })
    resHeaders.set("access-control-allow-origin", "*")

    return new NextResponse(upstreamResp.body, {
      status: upstreamResp.status,
      headers: resHeaders,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: "n8n unreachable", detail: err.message },
      { status: 502 },
    )
  }
}

type Params = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { path } = await params
  return proxy(req, path ?? [])
}
export async function POST(req: NextRequest, { params }: Params) {
  const { path } = await params
  return proxy(req, path ?? [])
}
export async function PUT(req: NextRequest, { params }: Params) {
  const { path } = await params
  return proxy(req, path ?? [])
}
export async function PATCH(req: NextRequest, { params }: Params) {
  const { path } = await params
  return proxy(req, path ?? [])
}
export async function DELETE(req: NextRequest, { params }: Params) {
  const { path } = await params
  return proxy(req, path ?? [])
}
