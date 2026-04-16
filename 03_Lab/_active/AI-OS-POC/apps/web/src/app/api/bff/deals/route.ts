import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiGetDeals, apiCreateDeal } from "@/lib/api-client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const deals = await apiGetDeals(session.user.token, searchParams)
  return NextResponse.json(deals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const deal = await apiCreateDeal(session.user.token, body)
  return NextResponse.json(deal, { status: 201 })
}
