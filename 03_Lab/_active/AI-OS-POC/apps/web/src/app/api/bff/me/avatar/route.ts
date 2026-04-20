// BFF: POST /api/bff/me/avatar — multipart avatar upload → resize → MinIO → update profile
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { s3PutObject, avatarKey } from "@/lib/s3-upload"
import { apiPatchMyProfile } from "@/lib/api-client"

const MINIO_PUBLIC = process.env.NEXT_PUBLIC_MINIO_URL ?? "http://10.10.110.31:9002"
const BUCKET = process.env.S3_BUCKET_UPLOADS ?? "uploads"
const MAX_DIM = 256   // px — sufficient for avatars
const MAX_BYTES = 512 * 1024

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

  const raw = Buffer.from(await file.arrayBuffer())

  // Auto-resize: cap at 256×256, re-encode as JPEG quality 85, then lower quality until ≤512 KB
  let processed = await sharp(raw).resize(MAX_DIM, MAX_DIM, { fit: "cover", position: "centre" }).jpeg({ quality: 85 }).toBuffer()
  if (processed.length > MAX_BYTES) {
    processed = await sharp(raw).resize(MAX_DIM, MAX_DIM, { fit: "cover", position: "centre" }).jpeg({ quality: 60 }).toBuffer()
  }

  // Always store as JPEG after resize
  const userId = (session.user as { id?: string }).id ?? session.user.email?.replace(/[^a-zA-Z0-9_-]/g, "_") ?? "unknown"
  const key = avatarKey(userId, "jpg")

  await s3PutObject(key, processed, "image/jpeg")

  const avatarUrl = `${MINIO_PUBLIC}/${BUCKET}/${key}?t=${Date.now()}`
  await apiPatchMyProfile(session.user.token, { avatar_url: avatarUrl })

  return NextResponse.json({ avatar_url: avatarUrl })
}
