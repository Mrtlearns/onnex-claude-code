"use client"
// apps/web/src/app/(protected)/documents/components/sign-request-modal.tsx
// Modal for initiating a LibreSign e-signature request on a Nextcloud file.

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Signer {
  name: string
  email: string
}

interface Props {
  open: boolean
  onClose: () => void
  filePath: string
  fileName: string
}

export function SignRequestModal({ open, onClose, filePath, fileName }: Props) {
  const [signers, setSigners] = useState<Signer[]>([{ name: "", email: "" }])
  const [expiresInDays, setExpiresInDays] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<"success" | "error" | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  function addSigner() {
    setSigners((s) => [...s, { name: "", email: "" }])
  }

  function removeSigner(i: number) {
    setSigners((s) => s.filter((_, idx) => idx !== i))
  }

  function updateSigner(i: number, field: keyof Signer, value: string) {
    setSigners((s) => s.map((signer, idx) => idx === i ? { ...signer, [field]: value } : signer))
  }

  function handleClose() {
    setSigners([{ name: "", email: "" }])
    setExpiresInDays("")
    setResult(null)
    setErrorMsg("")
    onClose()
  }

  async function handleSubmit() {
    // Basic validation
    for (const s of signers) {
      if (!s.name.trim() || !s.email.trim()) {
        setErrorMsg("All signers must have a name and email.")
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
        setErrorMsg(`Invalid email: ${s.email}`)
        return
      }
    }
    setErrorMsg("")
    setSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        file_path: filePath,
        file_name: fileName,
        signers,
      }
      if (expiresInDays) body.expires_in_days = Number(expiresInDays)

      const res = await fetch("/api/bff/documents/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error ?? `Request failed (${res.status})`)
        setResult("error")
      } else {
        setResult("success")
      }
    } catch {
      setErrorMsg("Network error — please try again.")
      setResult("error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send for Signing</DialogTitle>
        </DialogHeader>

        {result === "success" ? (
          <div className="py-4 space-y-2">
            <p className="text-sm text-green-600 font-medium">Signing request sent.</p>
            <p className="text-sm text-muted-foreground">
              {signers.map((s) => s.email).join(", ")} will receive an email with a signing link.
            </p>
            <p className="text-xs text-muted-foreground truncate" title={filePath}>{fileName}</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground truncate" title={filePath}>
              {fileName}
            </p>

            {/* Signers */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Signers
              </Label>
              {signers.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Full name"
                    value={s.name}
                    onChange={(e) => updateSigner(i, "name", e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={s.email}
                    onChange={(e) => updateSigner(i, "email", e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  {signers.length > 1 && (
                    <button
                      onClick={() => removeSigner(i)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove signer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addSigner}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add signer
              </button>
            </div>

            {/* Optional expiry */}
            <div className="flex items-center gap-3">
              <Label htmlFor="expiry" className="text-sm whitespace-nowrap">
                Expires in (days)
              </Label>
              <Input
                id="expiry"
                type="number"
                min="1"
                max="365"
                placeholder="e.g. 14"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-24 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">optional</span>
            </div>

            {errorMsg && (
              <p className="text-xs text-destructive">{errorMsg}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {result === "success" ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Sending…" : "Send for Signing"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
