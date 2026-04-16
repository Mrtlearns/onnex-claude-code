# MSG Extraction Integration Guide for Next.js/React

## Overview

This guide shows how to integrate MSG file extraction (email + attachments) into your existing Next.js RT/UT calculator platform.

**Architecture:**
- **Backend:** FastAPI server (`msg_api_server.py`) — handles .msg file processing
- **Frontend:** React component (`MSGExtractor.tsx`) — drag-drop UI + results display
- **Communication:** HTTP API calls between Next.js and FastAPI

---

## Setup Steps

### 1. Install Backend Dependencies

```bash
# Install FastAPI and uvicorn (if not already installed)
pip install fastapi uvicorn extract-msg --break-system-packages
```

### 2. Copy Files to Your Project

**Backend files:**
```bash
# Copy to your project backend directory (or anywhere accessible)
cp msg_api_server.py /path/to/your/backend/
cp msg_extractor.py /path/to/your/backend/
```

**Frontend files:**
```bash
# Copy to your Next.js components directory
cp MSGExtractor.tsx /path/to/your/next.js/app/components/
cp MSGExtractor.module.css /path/to/your/next.js/app/components/
```

### 3. Start the FastAPI Backend

```bash
# From the backend directory
python3 msg_api_server.py
```

Server will start on `http://localhost:8000`

You should see:
```
╔════════════════════════════════════════╗
║   MSG Extraction API - Starting...     ║
╚════════════════════════════════════════╝

📍 Server: http://localhost:8000
🎯 Upload endpoint: POST /api/upload
📥 Download endpoint: GET /api/download/{folder}/{filename}
🔄 Batch upload: POST /api/batch

🔗 Frontend: Connect from http://localhost:3000
📊 Docs: http://localhost:8000/docs
```

### 4. Add Component to Your Next.js Page

**Example: Create a new page for MSG extraction**

File: `app/msg-extractor/page.tsx`

```tsx
'use client'

import MSGExtractor from '@/components/MSGExtractor'

export default function MSGExtractorPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Email Message Extractor</h1>
      <p>Upload a .msg file to extract the email body and attachments</p>
      <MSGExtractor 
        apiUrl="http://localhost:8000"
        onExtract={(result) => {
          console.log('Extracted:', result)
        }}
      />
    </div>
  )
}
```

**Or integrate into existing calculator page:**

```tsx
'use client'

import MSGExtractor from '@/components/MSGExtractor'
import RTCalculator from '@/components/RTCalculator'
import { useState } from 'react'

export default function CalcPage() {
  const [extractedEmail, setExtractedEmail] = useState(null)

  return (
    <div>
      {/* MSG Extractor */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>Step 1: Extract Email</h2>
        <MSGExtractor 
          apiUrl="http://localhost:8000"
          onExtract={setExtractedEmail}
        />
      </section>

      {/* RT Calculator */}
      <section>
        <h2>Step 2: Calculate RT Requirements</h2>
        <RTCalculator 
          initialData={extractedEmail?.email}
        />
      </section>
    </div>
  )
}
```

---

## Component Usage

### Basic Usage

```tsx
import MSGExtractor from '@/components/MSGExtractor'

export default function MyPage() {
  return <MSGExtractor apiUrl="http://localhost:8000" />
}
```

### With Callback Handler

```tsx
import MSGExtractor from '@/components/MSGExtractor'
import { useState } from 'react'

export default function MyPage() {
  const [emailData, setEmailData] = useState(null)

  const handleExtract = (result) => {
    if (result.success) {
      console.log('Email from:', result.email.from)
      console.log('Attachments:', result.attachments)
      
      // Use data in your application
      setEmailData(result)
    } else {
      console.error('Extraction failed:', result.error)
    }
  }

  return (
    <MSGExtractor 
      apiUrl="http://localhost:8000"
      onExtract={handleExtract}
    />
  )
}
```

### Component Props

```typescript
interface MSGExtractorProps {
  apiUrl?: string              // FastAPI server URL (default: http://localhost:8000)
  onExtract?: (result) => void // Callback when extraction completes
}
```

### Extraction Result Format

```typescript
interface ExtractionResult {
  success: boolean
  error?: string                    // If success=false
  email?: {
    from: string                   // "Derek Arthurs <derek@taricco.com>"
    to: string
    subject: string
    date: string                   // ISO datetime
    body: string                   // Full email body
    bodyPreview: string            // First 200 chars
  }
  attachments?: {
    filename: string               // "document.pdf"
    size: number                   // bytes
    size_kb: number
    downloadUrl: string            // Direct download link
  }[]
  attachmentCount?: number
  extractedAt?: string
}
```

---

## API Endpoints

### Single File Upload

```
POST /api/upload
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "email": {
    "from": "...",
    "to": "...",
    "subject": "...",
    "date": "...",
    "body": "..."
  },
  "attachments": [
    {
      "filename": "file.pdf",
      "size": 12345,
      "downloadUrl": "/api/download/folder/file.pdf"
    }
  ]
}
```

### Batch Upload (Multiple Files)

```
POST /api/batch
Content-Type: multipart/form-data

Response:
{
  "batch": [
    { "success": true, "email": {...}, "attachments": [...] },
    { "success": true, "email": {...}, "attachments": [...] },
    ...
  ],
  "summary": {
    "total": 50,
    "succeeded": 49,
    "failed": 1
  }
}
```

### Download Attachment

```
GET /api/download/{folder}/{filename}

Returns: Binary file with proper Content-Disposition header
```

### Health Check

```
GET /api/health

Response:
{
  "status": "healthy",
  "timestamp": "2026-03-15T12:00:00",
  "temp_dir": "/tmp/msg_uploads",
  "temp_dir_exists": true
}
```

### API Docs

Swagger UI available at: `http://localhost:8000/docs`

---

## Deployment Scenarios

### Development (Localhost)

Both frontend and backend on localhost:

```bash
# Terminal 1: FastAPI backend
python3 msg_api_server.py
# Runs on http://localhost:8000

# Terminal 2: Next.js frontend
npm run dev
# Runs on http://localhost:3000

# In component:
<MSGExtractor apiUrl="http://localhost:8000" />
```

### Production (Proxmox VMs)

**Setup:**

1. **Backend VM:** Run FastAPI on dedicated VM or container
   ```bash
   python3 msg_api_server.py
   # Or in Docker/systemd for persistence
   ```

2. **Frontend VM:** Next.js app points to backend API
   ```tsx
   <MSGExtractor apiUrl="http://backend-vm-ip:8000" />
   ```

3. **Network:** Both VMs on same network or firewall rules open port 8000

### With Reverse Proxy (Nginx)

If you want both on same domain:

```nginx
# nginx.conf
upstream fastapi_backend {
    server localhost:8000;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Next.js frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    # MSG API
    location /api/ {
        proxy_pass http://fastapi_backend;
        proxy_set_header Host $host;
    }
}
```

Then in component:
```tsx
<MSGExtractor apiUrl="/api" />  // Relative path
```

---

## Workflow Examples

### Example 1: Extract → Auto-fill Calculator

```tsx
'use client'

import MSGExtractor from '@/components/MSGExtractor'
import RTCalculator from '@/components/RTCalculator'
import { useState } from 'react'

export default function CombinedWorkflow() {
  const [calcInputs, setCalcInputs] = useState(null)

  const handleExtract = (result) => {
    if (!result.success) return

    // Parse email body to extract specification
    const spec = parseSpecFromEmail(result.email.body)
    
    // Auto-fill calculator
    setCalcInputs({
      material: spec.material,
      thickness: spec.thickness,
      standardApplicable: spec.standard,
      attachments: result.attachments
    })
  }

  return (
    <>
      <MSGExtractor 
        apiUrl="http://localhost:8000"
        onExtract={handleExtract}
      />
      
      {calcInputs && (
        <RTCalculator initialData={calcInputs} />
      )}
    </>
  )
}

// Helper: Extract structured data from email body
function parseSpecFromEmail(body: string) {
  // Example: use regex or LLM to extract specs
  const materialMatch = body.match(/material[:\s]+([\w-]+)/i)
  const thicknessMatch = body.match(/thickness[:\s]+([\d.]+)/i)
  
  return {
    material: materialMatch?.[1] || '',
    thickness: parseFloat(thicknessMatch?.[1] || '0'),
    standard: 'ASME Section V'
  }
}
```

### Example 2: Store Extracted Data

```tsx
'use client'

import MSGExtractor from '@/components/MSGExtractor'
import { useCallback } from 'react'

export default function WithDatabaseStorage() {
  const handleExtract = useCallback(async (result) => {
    if (!result.success) return

    // Save to your database
    const response = await fetch('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: result.email.from,
        to: result.email.to,
        subject: result.email.subject,
        body: result.email.body,
        attachmentCount: result.attachmentCount,
        extractedAt: result.extractedAt
      })
    })

    const saved = await response.json()
    console.log('Saved to DB:', saved)
  }, [])

  return <MSGExtractor apiUrl="http://localhost:8000" onExtract={handleExtract} />
}
```

---

## Troubleshooting

### "Cannot POST /api/upload"

**Problem:** FastAPI backend not running or wrong URL

**Solution:**
```bash
# Check backend is running
python3 msg_api_server.py

# Check URL in component matches backend address
<MSGExtractor apiUrl="http://localhost:8000" />
```

### CORS Error in Browser Console

**Problem:** Frontend and backend on different origins

**Solution:** FastAPI already has CORS enabled for `localhost:3000`, but if using different domain:

Edit `msg_api_server.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://your-frontend-domain:3000", "*"],
    # ...
)
```

### File Size Limits

Default FastAPI limit is 25MB. To increase:

Edit `msg_api_server.py`:
```python
# At top of file
app = FastAPI(
    # ... other params
)

@app.post("/api/upload")
async def upload_msg_file(file: UploadFile = File(...)):
    # Check file size
    contents = await file.read()
    if len(contents) > 100_000_000:  # 100MB limit
        raise HTTPException(400, "File too large")
    # ... rest of function
```

### Attachments Not Downloading

**Check:**
1. Extraction succeeded (check browser console for success message)
2. FastAPI server has `/tmp/msg_extractions` directory
3. Download URL format: `/api/download/{folder}/{filename}`

---

## Next Steps

1. ✅ Start FastAPI backend
2. ✅ Add component to your Next.js page
3. ✅ Test with sample .msg file
4. ✅ Customize styling in `MSGExtractor.module.css`
5. ✅ Add `onExtract` callback for downstream processing
6. ✅ Deploy to Proxmox VMs for production

---

## File Locations

**Backend (Python):**
- `msg_api_server.py` — FastAPI server
- `msg_extractor.py` — Extraction logic (already built)

**Frontend (Next.js):**
- `MSGExtractor.tsx` — React component
- `MSGExtractor.module.css` — Styling

All files ready to use — no additional configuration needed!

---

## Support

For issues:
1. Check FastAPI docs: `http://localhost:8000/docs`
2. Review browser console for client-side errors
3. Check terminal output from FastAPI server for backend errors
4. Verify file is valid .msg format

Happy extracting! 🚀
