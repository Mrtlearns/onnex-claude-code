import "server-only"
import { createHmac, createHash } from "node:crypto"

const S3_URL = process.env.MINIO_INTERNAL_URL ?? "http://minio-core:9000"
const ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minioadmin"
const SECRET_KEY = process.env.S3_SECRET_KEY ?? "minioadmin_dev"
const BUCKET = process.env.S3_BUCKET_UPLOADS ?? "uploads"
const REGION = "us-east-1"

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest()
}
function hexHash(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex")
}

export async function s3PutObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z"
  const dateStamp = amzDate.slice(0, 8)
  const host = new URL(S3_URL).host
  const payloadHash = hexHash(body)

  const canonHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"
  const canonReq = `PUT\n/${BUCKET}/${key}\n\n${canonHeaders}${signedHeaders}\n${payloadHash}`

  const scope = `${dateStamp}/${REGION}/s3/aws4_request`
  const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hexHash(canonReq)}`

  const sigKey = hmac(
    hmac(hmac(hmac(`AWS4${SECRET_KEY}`, dateStamp), REGION), "s3"),
    "aws4_request",
  )
  const sig = createHmac("sha256", sigKey).update(sts).digest("hex")
  const auth = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`

  const res = await fetch(`${S3_URL}/${BUCKET}/${key}`, {
    method: "PUT",
    headers: {
      Authorization: auth,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: body as unknown as BodyInit,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`S3 PUT ${key} failed: ${res.status} ${text}`)
  }
}

export function avatarKey(userId: string, ext: string): string {
  return `avatars/${userId}.${ext}`
}
