# Web Integration - Quick Start (5 Minutes)

## 🎯 Goal
Drop a .msg file in your Next.js app → see email body + downloadable attachments

## 📋 Prerequisites
- Next.js app running
- Python 3.8+
- FastAPI + uvicorn installed: `pip install fastapi uvicorn extract-msg --break-system-packages`

---

## Step 1: Start the Backend (1 minute)

```bash
cd /path/to/msg/scripts
python3 msg_api_server.py
```

Expected output:
```
📍 Server: http://localhost:8000
🎯 Upload endpoint: POST /api/upload
```

**Done.** Backend is ready. Leave this terminal running.

---

## Step 2: Add Component to Your Next.js App (2 minutes)

### Copy Files

```bash
# From outputs directory to your Next.js project
cp MSGExtractor.tsx /path/to/your/next-app/app/components/
cp MSGExtractor.module.css /path/to/your/next-app/app/components/
```

### Create New Page

File: `app/msg-extractor/page.tsx`

```tsx
'use client'

import MSGExtractor from '@/components/MSGExtractor'

export default function MSGExtractorPage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>📧 Email Extractor</h1>
      <p>Drop a .msg file to extract the email and attachments</p>
      <MSGExtractor apiUrl="http://localhost:8000" />
    </main>
  )
}
```

---

## Step 3: Test It (2 minutes)

1. Open: `http://localhost:3000/msg-extractor`
2. Drop a `.msg` file on the drop zone (or click to browse)
3. See extracted email + attachments
4. Download attachments

**Done!** 🎉

---

## Integrate into Existing Page

Instead of a new page, add to your calculator:

```tsx
'use client'

import MSGExtractor from '@/components/MSGExtractor'
import RTCalculator from '@/components/RTCalculator'
import { useState } from 'react'

export default function CalcPage() {
  const [emailData, setEmailData] = useState(null)

  return (
    <>
      <section>
        <h2>Extract Email</h2>
        <MSGExtractor 
          apiUrl="http://localhost:8000"
          onExtract={setEmailData}  // Capture extraction
        />
      </section>

      <section>
        <h2>Calculate RT</h2>
        <RTCalculator data={emailData?.email} />
      </section>
    </>
  )
}
```

---

## Common Issues

### "ECONNREFUSED localhost:8000"
Backend not running.
```bash
python3 msg_api_server.py
```

### "CORS error in console"
FastAPI allows `localhost:3000` by default. If using different port, edit `msg_api_server.py` line ~30.

### File upload fails silently
Check browser console (F12) for error. Backend logs in terminal.

---

## What Each File Does

| File | Purpose |
|------|---------|
| `msg_api_server.py` | FastAPI backend (handles .msg extraction) |
| `msg_extractor.py` | Core extraction logic (already built) |
| `MSGExtractor.tsx` | React component (drop-zone + results) |
| `MSGExtractor.module.css` | Component styling |

---

## API Endpoints Available

```
POST /api/upload           # Single file upload
POST /api/batch            # Multiple files
GET /api/download/{...}    # Download attachment
GET /api/health            # Health check
GET /docs                  # Swagger UI
```

Full docs at: `http://localhost:8000/docs`

---

## Next: Connect to Your Workflow

Once working, hook up the extracted data:

```tsx
const handleExtract = (result) => {
  // Use email data in your app
  console.log('From:', result.email.from)
  console.log('Subject:', result.email.subject)
  console.log('Body:', result.email.body)
  console.log('Attachments:', result.attachments)
  
  // Pass to calculator, save to DB, etc.
}

<MSGExtractor 
  apiUrl="http://localhost:8000"
  onExtract={handleExtract}
/>
```

---

## For Production (Proxmox VMs)

Instead of `localhost:8000`, use:
- Backend VM IP: `http://192.168.x.x:8000`
- Or with reverse proxy: `https://yourdomain.com/api`

Edit in component:
```tsx
<MSGExtractor apiUrl="http://backend-vm-ip:8000" />
```

---

## That's It!

You now have:
✅ Email extraction from .msg files  
✅ Attachment download links  
✅ Beautiful UI in your Next.js app  
✅ Ready to integrate into RT/UT calculator  

For detailed docs → `INTEGRATION_GUIDE.md`
