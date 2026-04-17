import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetTasks, apiCreateTask } from "@/lib/api-client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const tasks = await apiGetTasks(session.user.token, searchParams)
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const task = await apiCreateTask(session.user.token, body)
  return NextResponse.json(task, { status: 201 })
}
