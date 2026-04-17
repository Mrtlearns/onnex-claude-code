import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetTask, apiPatchTask } from "@/lib/api-client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const task = await apiGetTask(session.user.token, id)
  return NextResponse.json(task)
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
  const task = await apiPatchTask(session.user.token, id, body)
  return NextResponse.json(task)
}
