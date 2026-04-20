// BFF: POST /api/bff/admin/staff/:id/avatar — admin uploads avatar on behalf of any user
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { s3PutObject, avatarKey } from "@/lib/s3-upload"
import { apiPatchStaff } from "@/lib/api-client"

const MINIO_PUBLIC = process.env.NEXT_PUBLIC_MINIO_URL ?? "http://10.10.110.31:9002"
const BUCKET = process.env.S3_BUCKET_UPLOADS ?? "uploads"
const MAX_DIM = 256
const MAX_BYTES = 512 * 1024

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("avatar") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const raw = Buffer.from(await file.arrayBuffer())
  let processed = await sharp(raw).resize(MAX_DIM, MAX_DIM, { fit: "cover", position: "centre" }).jpeg({ quality: 85 }).toBuffer()
  if (processed.length > MAX_BYTES) {
    processed = await sharp(raw).resize(MAX_DIM, MAX_DIM, { fit: "cover", position: "centre" }).jpeg({ quality: 60 }).toBuffer()
  }

  const key = avatarKey(params.id, "jpg")
  await s3PutObject(key, processed, "image/jpeg")

  const avatarUrl = `${MINIO_PUBLIC}/${BUCKET}/${key}?t=${Date.now()}`
  await apiPatchStaff(session.user.token, params.id, { avatar_url: avatarUrl })

  return NextResponse.json({ avatar_url: avatarUrl })
}
