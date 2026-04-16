/**
 * Salesforce Writeback — Client Credentials OAuth2
 *
 * After a UT quote is generated from a Salesforce trigger, this writes the
 * quoteNumber and grandTotal back to the originating Opportunity.
 *
 * Auth: External Client App, client_credentials grant
 *   Token URL: https://ndt.my.salesforce.com/services/oauth2/token
 *   Note: use ndt.my.salesforce.com — NOT login.salesforce.com
 *
 * Required env vars (set in docker-compose.yml):
 *   SF_INSTANCE_URL    https://ndt.my.salesforce.com
 *   SF_CLIENT_ID       External Client App consumer key
 *   SF_CLIENT_SECRET   External Client App consumer secret
 *
 * Fields written to Opportunity (writable, no custom fields needed):
 *   Pricing_Details__c  ← "Quote #UT-XXXX | $X,XXX.XX | ID: <uuid>" (textarea)
 *   Price_Per__c        ← grandTotal   (currency — "Price Per Part Quoted")
 *   Lab_Status__c       ← "In Process" (picklist)
 *   Quote_Due_Date__c   ← generatedAt  (date YYYY-MM-DD)
 *
 * Note: Invoice_No__c and Total__c are formula/rollup fields — read-only via API.
 */

export interface SfWritebackPayload {
  opportunityId: string;
  quoteNumber: string;
  grandTotal: number;
  generatedAt: string;
  quoteId: string;
}

// Simple in-process token cache — avoids a round-trip on every quote
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getSfAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const instanceUrl  = process.env.SF_INSTANCE_URL;
  const clientId     = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;

  if (!instanceUrl || !clientId || !clientSecret) {
    throw new Error('SF credentials not configured (SF_INSTANCE_URL / SF_CLIENT_ID / SF_CLIENT_SECRET)');
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${instanceUrl}/services/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SF token request failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; instance_url: string; issued_at: string };

  // SF client_credentials tokens are valid ~2h; cache for 90 minutes
  cachedToken = { value: data.access_token, expiresAt: now + 90 * 60 * 1000 };
  return cachedToken.value;
}

export async function writeback(payload: SfWritebackPayload): Promise<void> {
  const instanceUrl = process.env.SF_INSTANCE_URL;
  if (!instanceUrl) {
    console.warn('[sf-writeback] SF_INSTANCE_URL not set — skipping writeback');
    return;
  }

  let token: string;
  try {
    token = await getSfAccessToken();
  } catch (err) {
    console.error('[sf-writeback] Could not obtain SF access token:', err);
    return;
  }

  const url = `${instanceUrl}/services/data/v59.0/sobjects/Opportunity/${payload.opportunityId}`;

  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Pricing_Details__c: `Quote #${payload.quoteNumber} | $${payload.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Portal ID: ${payload.quoteId}`,
      Price_Per__c:       payload.grandTotal,
      Lab_Status__c:      'In Process',
      Quote_Due_Date__c:  payload.generatedAt.slice(0, 10), // YYYY-MM-DD
    }),
  });

  // SF PATCH returns 204 No Content on success
  if (res.status === 204) {
    console.log('[sf-writeback] Opportunity updated:', payload.opportunityId, {
      quoteNumber: payload.quoteNumber,
      grandTotal:  payload.grandTotal,
    });
    return;
  }

  // Token may have been revoked mid-flight — invalidate cache and log
  if (res.status === 401) {
    cachedToken = null;
  }

  const body = await res.text();
  console.error(`[sf-writeback] PATCH failed (${res.status}):`, body);
}
