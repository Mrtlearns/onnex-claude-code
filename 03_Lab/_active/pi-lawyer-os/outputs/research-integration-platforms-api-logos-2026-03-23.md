# Research: PI Lawyer OS Integration Platform APIs and Logos

**Date:** 2026-03-23
**Mode:** Standard
**Vertical:** PI Law
**Primary Question:** What API credentials are needed for each integration platform, and where can official logos be obtained?
**Decision It Informs:** Settings/Integrations page UI implementation with correct credential fields and brand assets

---

## Key Findings

1. **MyCase** has a public OAuth-based API available only in Advanced tier ($109+/mo). Contact support for access. **Confidence: High**

2. **CasePeer** does NOT have an open public API. Integration is via Zapier or partner-specific API keys provided on activation. **Confidence: High**

3. **Gmail/Google Workspace** requires OAuth 2.0 credentials: `client_id`, `client_secret`, `redirect_uri`, plus scopes. Created in Google Cloud Console. **Confidence: High**

4. **Scorpion** has NO public developer API. Integration is B2B partnership-only (e.g., Clio integration). **Confidence: High**

5. **ConvertIT Marketing** has NO public API. They are a lead gen service agency, not a SaaS platform. **Confidence: High**

6. **PI Boost** appears to NOT exist as a distinct product/company. May be a generic term or internal reference. **Confidence: Medium**

7. **PandaDoc** has robust API with two auth methods: API Key (`API-Key` header) or OAuth 2.0 (`client_id`, `client_secret`, `access_token`). **Confidence: High**

8. **Google Sheets** requires either OAuth 2.0 credentials or Service Account JSON key file. Same as Gmail (Google Cloud Console). **Confidence: High**

---

## Platform-by-Platform Analysis

### 1. MyCase (mycase.com)

**API Status:** Public API available (Advanced Tier only)

**Authentication:** OAuth 2.0
- MyCase uses OAuth and does not store/request user credentials directly
- Authentication flow managed through their OAuth implementation

**Credentials Needed:**
| Credential | Description |
|------------|-------------|
| `client_id` | OAuth application client ID |
| `client_secret` | OAuth application secret |
| `redirect_uri` | Callback URL for OAuth flow |
| `access_token` | Bearer token obtained via OAuth |
| `refresh_token` | For token refresh |

**How to Get Access:**
1. Must be on **Advanced Tier** ($109/user/month annual, $119/month monthly)
2. Contact MyCase support to request API access
3. Can test with 10-day free trial
4. API docs: https://mycaseapi.stoplight.io/

**Logo Sources:**
- Brandfetch: https://brandfetch.com/mycase.com (SVG, PNG, vector)

---

### 2. CasePeer (casepeer.com)

**API Status:** NO open public API

**Integration Options:**
- **Zapier Integration** - Connect via Zapier with triggers like "Case Status Change"
- **Partner API Keys** - CasePeer provides API keys for specific activated integrations (Records On Time, Lead Docket, etc.)
- **Nightly Data Sync** - Available with CASEpeer Advanced

**Credentials (for partner integrations):**
| Credential | Description |
|------------|-------------|
| `api_key` | Generated per-integration when activated in CasePeer settings |

**How to Get Access:**
1. Activate specific integration in CasePeer settings
2. Copy the generated API key
3. Provide to partner representative
4. No general-purpose developer API available

**Logo Sources:**
- SeekLogo: https://seeklogo.com/vector-logo/527768/casepeer (PNG, SVG)

---

### 3. Gmail / Google Workspace

**API Status:** Full public API via Google Workspace APIs

**Authentication:** OAuth 2.0 (user consent) or Service Account (server-to-server)

**Credentials Needed (OAuth 2.0):**
| Credential | Description |
|------------|-------------|
| `client_id` | OAuth 2.0 Client ID from Google Cloud Console |
| `client_secret` | OAuth 2.0 Client Secret (store securely!) |
| `redirect_uri` | Authorized redirect URI(s) |
| `scopes` | Gmail API scopes (e.g., `gmail.readonly`, `gmail.send`) |
| `access_token` | Short-lived bearer token |
| `refresh_token` | Long-lived token for refresh |

**Credentials Needed (Service Account):**
| Credential | Description |
|------------|-------------|
| `service_account_json` | JSON key file with private key |
| `delegated_user` | Email of user to impersonate (domain-wide delegation) |

**How to Get Access:**
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create a project
3. Enable Gmail API (APIs & Services > Library)
4. Create credentials (APIs & Services > Credentials > Create Credentials > OAuth client ID)
5. Configure OAuth consent screen
6. Download credentials JSON

**Logo Sources:**
- Official: https://about.google/brand-resource-center/brand-elements/
- Mailmeteor: https://mailmeteor.com/logos/gmail (PNG, SVG all sizes)
- Gmelius: https://gmelius.com/logos/gmail

---

### 4. Scorpion (scorpionco.com / scorpion.co)

**API Status:** NO public developer API

**Integration Model:** B2B Partnership only
- Technical integration exists with Clio Grow (leads flow to Clio)
- Built on Twilio APIs for call tracking
- No self-service API access for developers

**How to Integrate:**
- Must establish business partnership with Scorpion
- Contact sales/partnerships team
- Integration is managed service, not self-service

**Logo Sources:**
- Brandfetch: https://brandfetch.com/scorpion.co (SVG, PNG, vector)

---

### 5. ConvertIT (convertitmarketing.com)

**API Status:** NO API

**Nature of Service:** Lead generation agency, not SaaS platform
- Provides PPC campaigns, call tracking, lead gen services
- Delivers inbound calls and leads to law firms
- No technical integration available

**How to "Integrate":**
- Sign up as a client
- They manage campaigns on your behalf
- Leads delivered via phone/email (no API)

**Logo Sources:**
- Would need to request directly from ConvertIT or screenshot from website

---

### 6. PI Boost

**Status:** NOT FOUND as a distinct product/company

**Research Notes:**
- Multiple searches returned no results for "PI Boost" as a social media marketing company
- May be:
  - Internal/colloquial term
  - A feature within another platform
  - A very new/small company not indexed
  - A misremembered name

**Recommendation:** Clarify the actual company name or remove from integrations list

---

### 7. PandaDoc (pandadoc.com)

**API Status:** Full public REST API

**Authentication Options:**

**Option 1: API Key (simpler)**
| Credential | Description |
|------------|-------------|
| `api_key` | Generated in PandaDoc Settings > Integrations > API |

Header format: `Authorization: API-Key {{api_key}}`

**Option 2: OAuth 2.0 (for multi-tenant apps)**
| Credential | Description |
|------------|-------------|
| `client_id` | OAuth application ID from Dev Center |
| `client_secret` | OAuth application secret |
| `access_token` | Bearer token from OAuth flow |
| `refresh_token` | For token refresh |

**API Key Types:**
- **Sandbox Key** - Test environment (Business, Enterprise, API plans)
- **Production Key** - Live environment

**How to Get Access:**
1. Must be Org Admin to generate keys
2. Go to PandaDoc Settings > Integrations > API
3. Generate Sandbox or Production key
4. For OAuth: Create application in Dev Center

**API Docs:** https://developers.pandadoc.com/

**Logo Sources:**
- Brandfetch: https://brandfetch.com/pandadoc.com
- SeekLogo: https://seeklogo.com/vector-logo/339028/pandadoc

---

### 8. Google Sheets (via Sheets API v4)

**API Status:** Full public API

**Authentication:** Same as Gmail/Google Workspace (shared credentials)

**Credentials Needed:**
Same as Gmail section above. Can use either:
- OAuth 2.0 (for user-context access)
- Service Account (for bot/server access)

**Special Note for Service Accounts:**
- Service account email must be shared on specific spreadsheets
- Or use domain-wide delegation for org-wide access

**How to Get Access:**
1. Same steps as Gmail
2. Enable **Google Sheets API** instead of Gmail API
3. Share target spreadsheets with service account email

**Logo Sources:**
- Wikimedia: https://commons.wikimedia.org/wiki/File:Google_Sheets_2020_Logo.svg
- Mailmeteor: https://mailmeteor.com/logos/google-sheets
- Gmelius: https://gmelius.com/logos/google-sheets

---

## Existing Integration Logo Sources

### DocuSign
- **Official Press Kit:** https://brandfolder.com/docusign-1/press-kit
- **Brand Guidelines:** https://www.docusign.com/ip/trademark-brand-guide
- **Brandfetch:** https://brandfetch.com/docusign.com
- **CDNLogo:** https://cdnlogo.com/logo/docusign_131206.html

### Twilio
- **Official:** https://www.twilio.com/brand (partners/press)
- **Brandfetch:** https://brandfetch.com/twilio.com
- **Logo.wine:** https://www.logo.wine/logo/Twilio
- **Brand Color:** Signal Red #F22F46

### Salesforce
- **Official Media Library:** https://www.salesforce.com/news/media-library/
- **Press Contact:** pr@salesforce.com
- **Brandfetch:** https://brandfetch.com/salesforce.com
- **SeekLogo:** https://seeklogo.com/vector-logo/273876/salesforce

### Clio
- **Official Brand Assets:** https://www.clio.com/about/brand-assets/
- **Brandfetch:** https://brandfetch.com/goclio.com
- **Logotyp.us:** https://logotyp.us/logo/clio/

### Google Maps
- **Official (requires partner access):** https://partnermarketinghub.withgoogle.com/brands/google-maps/
- **Wikimedia:** https://commons.wikimedia.org/wiki/File:Google_Maps_Logo_2020.svg
- **Logo.wine:** https://www.logo.wine/logo/Google_Maps

### SendGrid
- **Brandfetch:** https://brandfetch.com/sendgrid.com
- **SeekLogo:** https://seeklogo.com/vector-logo/289294/sendgrid
- **CDNLogo:** https://cdnlogo.com/logo/sendgrid_49381.html

---

## Recommended Logo CDN Strategy

For consistency, use **Brandfetch** as primary source when available:
- Consistent format (SVG primary, PNG fallback)
- Brand colors included
- Updated logos

| Platform | Brandfetch URL |
|----------|----------------|
| MyCase | https://brandfetch.com/mycase.com |
| PandaDoc | https://brandfetch.com/pandadoc.com |
| DocuSign | https://brandfetch.com/docusign.com |
| Twilio | https://brandfetch.com/twilio.com |
| Salesforce | https://brandfetch.com/salesforce.com |
| Clio | https://brandfetch.com/goclio.com |
| SendGrid | https://brandfetch.com/sendgrid.com |
| Scorpion | https://brandfetch.com/scorpion.co |

For Google products, use official SVGs from Wikimedia Commons or apply for partner access.

---

## Conflicts & Uncertainties

1. **PI Boost** - Cannot confirm existence. Need clarification on actual company name.

2. **ConvertIT** - Confirmed as agency, not platform. May not be appropriate for "integrations" list unless reframed as "Partners" or "Lead Sources."

3. **Scorpion** - No developer API. Would need B2B partnership agreement to integrate. May not be feasible for self-service integration UI.

4. **CasePeer Open API** - Explicitly stated they do NOT have an open API. Only partner-specific integrations.

---

## Onnex Implications

For PI Lawyer OS Settings > Integrations page:

**Tier 1 - Full API Integration (show credential fields):**
- Gmail / Google Workspace
- Google Sheets
- PandaDoc
- DocuSign (existing)
- Twilio (existing)
- Salesforce (existing)
- SendGrid (existing)

**Tier 2 - Partner Integration (show "Connect" button, handled externally):**
- MyCase (requires Advanced tier, OAuth flow)
- Clio (existing)

**Tier 3 - Zapier/Webhook Only:**
- CasePeer (via Zapier, no direct API)

**Tier 4 - Remove or Recategorize:**
- Scorpion - Move to "Marketing Partners" section, not integrations
- ConvertIT - Move to "Lead Sources" section, not integrations
- PI Boost - Remove unless clarified

---

## Recommendations

1. **Update integrations UI** to show appropriate credential fields per platform (see analysis above)

2. **Remove PI Boost** from integrations list pending clarification

3. **Recategorize Scorpion and ConvertIT** as "Marketing Partners" or "Lead Sources" rather than API integrations

4. **Use Brandfetch CDN** for logo assets where possible (consistent quality, formats)

5. **For CasePeer**, implement Zapier webhook integration rather than direct API

6. **Add disclaimer** on MyCase integration that Advanced tier ($109+/mo) is required

---

## Sources

| # | URL | Type | Verified | Used For |
|---|-----|------|----------|----------|
| 1 | https://mycaseapi.stoplight.io/ | Primary | Yes | MyCase API docs reference |
| 2 | https://supportcenter.mycase.com/en/articles/9370198-open-api | Primary | Yes | MyCase API access requirements |
| 3 | https://casepeer.zendesk.com/hc/en-us/articles/360043086271-Does-CASEpeer-have-an-Open-API | Primary | Yes | CasePeer no open API confirmation |
| 4 | https://developers.google.com/identity/protocols/oauth2 | Primary | Yes | Google OAuth2 documentation |
| 5 | https://developers.google.com/workspace/guides/create-credentials | Primary | Yes | Google credential creation |
| 6 | https://developers.pandadoc.com/reference/auth-overview | Primary | Yes | PandaDoc auth methods |
| 7 | https://developers.pandadoc.com/reference/api-key-authentication-process | Primary | Yes | PandaDoc API key auth |
| 8 | https://www.scorpion.co/how-we-help/integrations/ | Primary | Yes | Scorpion integration model |
| 9 | https://www.convertitmarketing.com/ | Primary | Yes | ConvertIT service description |
| 10 | https://brandfetch.com/ | Secondary | Yes | Logo asset source |
| 11 | https://www.clio.com/about/brand-assets/ | Primary | Yes | Clio official brand assets |
| 12 | https://brandfolder.com/docusign-1/press-kit | Primary | Yes | DocuSign press kit |
| 13 | https://www.salesforce.com/news/media-library/ | Primary | Yes | Salesforce media library |
| 14 | https://commons.wikimedia.org/wiki/File:Google_Sheets_2020_Logo.svg | Secondary | Yes | Google Sheets logo |
| 15 | https://commons.wikimedia.org/wiki/File:Google_Maps_Logo_2020.svg | Secondary | Yes | Google Maps logo |
