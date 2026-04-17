// apps/web/src/app/api/bff/documents/comments/[id]/route.ts
// BFF proxy: DELETE a document comment → aios-api /document-comments/:id

import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const AIOS_API =
  process.env.AIOS_API_INTERNAL_URL ?? "http://aios-api:3001"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(
    `${AIOS_API}/api/v1/document-comments/${params.id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.user.token}`,
      },
    },
  )

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
