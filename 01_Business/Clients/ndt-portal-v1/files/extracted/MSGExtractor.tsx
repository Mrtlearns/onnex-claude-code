/**
 * MSG Extractor Component
 * Drop-zone file upload + extracted email preview + attachment downloads
 * 
 * Usage in your Next.js app:
 *   import MSGExtractor from '@/components/MSGExtractor'
 *   
 *   export default function CalcPage() {
 *     return <MSGExtractor apiUrl="http://localhost:8000" />
 *   }
 */

'use client'

import React, { useState, useRef } from 'react'
import styles from './MSGExtractor.module.css'

interface EmailData {
  from: string
  to: string
  subject: string
  date: string
  body: string
  bodyPreview: string
}

interface Attachment {
  filename: string
  size: number
  size_kb: number
  downloadUrl: string
}

interface ExtractionResult {
  success: boolean
  error?: string
  email?: EmailData
  attachments?: Attachment[]
  attachmentCount?: number
  extractedAt?: string
}

interface MSGExtractorProps {
  apiUrl?: string
  onExtract?: (result: ExtractionResult) => void
}

export default function MSGExtractor({ 
  apiUrl = 'http://localhost:8000',
  onExtract 
}: MSGExtractorProps) {
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.msg')) {
      setError('Please select a .msg file')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }

      const data: ExtractionResult = await response.json()
      setResult(data)

      if (onExtract) {
        onExtract(data)
      }

      if (!data.success) {
        setError(data.error || 'Extraction failed')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Upload error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const downloadAttachment = (downloadUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className={styles.container}>
      {/* Drop Zone */}
      <div
        className={`${styles.dropZone} ${dragActive ? styles.active : ''} ${
          loading ? styles.loading : ''
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".msg"
          onChange={handleChange}
          className={styles.hiddenInput}
          disabled={loading}
        />

        <div className={styles.dropZoneContent}>
          {loading ? (
            <>
              <div className={styles.spinner}></div>
              <p>Extracting email...</p>
            </>
          ) : (
            <>
              <svg
                className={styles.icon}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              <h3>Drop .msg file here</h3>
              <p>or click to browse</p>
              <p className={styles.hint}>
                Supported: Microsoft Outlook messages (.msg)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorBox}>
          <svg
            className={styles.errorIcon}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h4>Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && result.success && result.email && (
        <div className={styles.results}>
          {/* Email Header */}
          <div className={styles.emailCard}>
            <div className={styles.emailHeader}>
              <div className={styles.emailMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.label}>From:</span>
                  <span className={styles.value}>{result.email.from}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.label}>To:</span>
                  <span className={styles.value}>{result.email.to}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.label}>Subject:</span>
                  <span className={styles.value}>{result.email.subject}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.label}>Date:</span>
                  <span className={styles.value}>
                    {new Date(result.email.date).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className={styles.emailBody}>
              <h4>Message</h4>
              <div className={styles.bodyContent}>
                {result.email.body}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {result.attachments && result.attachments.length > 0 && (
            <div className={styles.attachmentsCard}>
              <h4>
                Attachments ({result.attachmentCount})
              </h4>
              <div className={styles.attachmentsList}>
                {result.attachments.map((att, idx) => (
                  <div key={idx} className={styles.attachmentItem}>
                    <div className={styles.attachmentInfo}>
                      <svg
                        className={styles.attachmentIcon}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M8 16.5a1 1 0 11-2 0 1 1 0 012 0zM15 16.5a1 1 0 11-2 0 1 1 0 012 0z" />
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0015.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                      </svg>
                      <div>
                        <p className={styles.filename}>{att.filename}</p>
                        <p className={styles.filesize}>{att.size_kb} KB</p>
                      </div>
                    </div>
                    <button
                      className={styles.downloadBtn}
                      onClick={() =>
                        downloadAttachment(att.downloadUrl, att.filename)
                      }
                    >
                      <svg
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                      </svg>
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Summary */}
          <div className={styles.successBox}>
            <svg
              className={styles.successIcon}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p>
                ✓ Email extracted successfully
                {result.attachmentCount > 0 &&
                  ` • ${result.attachmentCount} attachment${
                    result.attachmentCount > 1 ? 's' : ''
                  } ready to download`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
