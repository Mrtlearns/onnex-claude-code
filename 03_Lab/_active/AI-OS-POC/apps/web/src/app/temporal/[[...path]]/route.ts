/**
 * Full-path proxy for embedded Temporal UI (SvelteKit SPA).
 *
 * SvelteKit builds assets at /_app/... with an absolute base path.
 * This proxy:
 *  1. Rewrites /_app/ → /temporal/_app/ in HTML so the browser fetches assets
 *     through this same route.
 *  2. Fixes SvelteKit's inline `base: ""` → `base: "/temporal"` so client-side
 *     routing constructs correct hrefs.
 *  3. Removes the <meta http-equiv="content-security-policy"> tag so the modified
 *     inline script is allowed to execute (the hash no longer matches after rewrite).
 *  4. Strips X-Frame-Options and HTTP-level CSP headers.
 *
 * Route: /temporal/[[...path]]
 *   /temporal/             → http://temporal-ui:8080/
 *   /temporal/_app/xxx.js  → http://temporal-ui:8080/_app/xxx.js
 *   /temporal/namespaces   → http://temporal-ui:8080/namespaces
 */

import { NextRequest, NextResponse } from "next/server"

const TEMPORAL_ORIGIN = process.env.TEMPORAL_UI_INTERNAL_URL ?? "http://temporal-ui:8080"

const STRIPPED_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
])

function rewriteHtml(html: string): string {
  // 1. Remove inline CSP meta tag (its hash is invalidated by our rewrites)
  html = html.replace(/<meta[^>]+http-equiv=["']content-security-policy["'][^>]*\/?>/gi, "")
  // 2. Rewrite all /_app/ asset paths to /temporal/_app/
  html = html.replace(/\/_app\//g, "/temporal/_app/")
  // 3. Fix SvelteKit base path so client-side routing works
  html = html.replace(/base:\s*""/g, 'base: "/temporal"')
  return html
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const upstreamPath = pathSegments.length > 0 ? "/" + pathSegments.join("/") : "/"
  const targetUrl = `${TEMPORAL_ORIGIN}${upstreamPath}${req.nextUrl.search}`

  try {
    const upstreamResp = await fetch(targetUrl, {
      method: req.method,
      headers: {
        host: new URL(TEMPORAL_ORIGIN).host,
        accept: req.headers.get("accept") ?? "*/*",
        "accept-language": req.headers.get("accept-language") ?? "en",
        "accept-encoding": "identity",
        cookie: req.headers.get("cookie") ?? "",
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

    const contentType = resHeaders.get("content-type") ?? ""
    if (contentType.includes("text/html")) {
      const html = rewriteHtml(await upstreamResp.text())
      resHeaders.set("content-type", "text/html; charset=utf-8")
      resHeaders.delete("content-length")
      return new NextResponse(html, { status: upstreamResp.status, headers: resHeaders })
    }

    return new NextResponse(upstreamResp.body, { status: upstreamResp.status, headers: resHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: "temporal-ui unreachable", detail: err.message }, { status: 502 })
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
