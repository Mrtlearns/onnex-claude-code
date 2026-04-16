import { createClient } from '@supabase/supabase-js'

// Public-facing URL — used to generate browser-accessible storage URLs
const supabaseUrl = process.env.SUPABASE_URL!
// Internal Docker URL — used for server-side API calls (upload, delete)
const supabaseInternalUrl = process.env.SUPABASE_INTERNAL_URL ?? supabaseUrl

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

// Server-side admin client — points at internal Docker hostname to avoid DNS failures
export const supabaseAdmin = createClient(supabaseInternalUrl, supabaseServiceKey)

// Client-side / anon client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? 'poc-personal-to-do-uploads'

/** Returns a browser-accessible public URL for a stored file. */
export function getPublicFileUrl(storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`
}

export async function uploadFile(
  file: Buffer,
  path: string,
  mimeType: string
): Promise<{ path: string; url: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: false })

  if (error) throw error

  return { path: data.path, url: getPublicFileUrl(data.path) }
}
