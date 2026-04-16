import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiPatchDealStage } from "@/lib/api-client"

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
  const deal = await apiPatchDealStage(session.user.token, id, body)
  return NextResponse.json(deal)
}
