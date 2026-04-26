"use client"
// apps/web/src/hooks/use-authenticated-blob-url.ts
import { useEffect, useRef, useState } from "react"

export function useAuthenticatedBlobUrl(url: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prevUrl = useRef<string | null>(null)
  const prevBlob = useRef<string | null>(null)

  useEffect(() => {
    if (!url) {
      setBlobUrl(null)
      return
    }
    if (url === prevUrl.current) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.blob()
      })
      .then((blob) => {
        if (cancelled) return
        if (prevBlob.current) URL.revokeObjectURL(prevBlob.current)
        const objectUrl = URL.createObjectURL(blob)
        prevBlob.current = objectUrl
        prevUrl.current = url
        setBlobUrl(objectUrl)
        setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => {
    return () => {
      if (prevBlob.current) URL.revokeObjectURL(prevBlob.current)
    }
  }, [])

  return { blobUrl, loading, error }
}
