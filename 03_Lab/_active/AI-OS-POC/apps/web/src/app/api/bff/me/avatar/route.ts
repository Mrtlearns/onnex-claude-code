// BFF: POST /api/bff/me/avatar — multipart avatar upload → MinIO → update profile
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { s3PutObject, avatarKey } from "@/lib/s3-upload"
import { apiPatchMyProfile } from "@/lib/api-client"

const MINIO_PUBLIC = process.env.NEXT_PUBLIC_MINIO_URL ?? "http://10.10.110.31:9000"
const BUCKET = process.env.S3_BUCKET_UPLOADS ?? "uploads"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("avatar") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const maxBytes = 512 * 1024 // 512 KB
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File too large (max 512 KB)" }, { status: 413 })
  }

  const ext = file.type === "image/png" ? "png" : "jpg"
  // session.user.id is set by next-auth from the JWT sub claim
  const userId = (session.user as { id?: string }).id ?? session.user.email?.replace(/[^a-zA-Z0-9_-]/g, "_") ?? "unknown"
  const key = avatarKey(userId, ext)

  const buffer = Buffer.from(await file.arrayBuffer())
  await s3PutObject(key, buffer, file.type || "image/jpeg")

  const avatarUrl = `${MINIO_PUBLIC}/${BUCKET}/${key}`
  await apiPatchMyProfile(session.user.token, { avatar_url: avatarUrl })

  return NextResponse.json({ avatar_url: avatarUrl })
}
