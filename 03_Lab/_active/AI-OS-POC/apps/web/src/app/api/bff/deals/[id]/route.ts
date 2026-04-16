import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetDeal, apiPatchDeal } from "@/lib/api-client"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const deal = await apiGetDeal(session.user.token, id)
  return NextResponse.json(deal)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const deal = await apiPatchDeal(session.user.token, id, body)
  return NextResponse.json(deal)
}
