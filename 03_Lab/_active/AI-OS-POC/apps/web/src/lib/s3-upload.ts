import "server-only"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

const S3_URL = process.env.MINIO_INTERNAL_URL ?? "http://minio-core:9000"
const ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minioadmin"
const SECRET_KEY = process.env.S3_SECRET_KEY ?? "minioadmin_dev"
const BUCKET = process.env.S3_BUCKET_UPLOADS ?? "uploads"

const s3 = new S3Client({
  endpoint: S3_URL,
  region: "us-east-1",
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
})

export async function s3PutObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export function avatarKey(userId: string, ext: string): string {
  return `avatars/${userId}.${ext}`
}
