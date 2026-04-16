# Research: PI Law Firm Software Integrations

**Date:** 2026-03-21
**Mode:** Extensive
**Vertical:** PI Law
**Primary Question:** What are the most commonly used software integrations for Personal Injury law firms (5-20 attorneys), and what API credentials are required for each?
**Decision It Informs:** Building an integrations settings page for PI Lawyer OS

---

## Key Findings

1. **Case management dominates the integration landscape** — Filevine, Clio, SmartAdvocate, and CASEpeer are the most API-friendly platforms for PI firms, with Filevine owning the PI/mass tort space and Clio having the broadest ecosystem (250+ integrations). Confidence: High

2. **OAuth 2.0 is the standard** — Nearly all modern legal tech integrations use OAuth 2.0 for authentication, though some still support API keys for simpler integrations. Most require client_id + client_secret pairs. Confidence: High

3. **Medical records retrieval lacks public APIs** — Compex, Record Retrieval Solutions, and similar services integrate primarily through case management system partnerships rather than direct API access. They prefer portal-based or partner integrations. Confidence: Medium

4. **Court e-filing is jurisdiction-specific** — Tyler Technologies (Odyssey/FileAndServe) dominates but requires court-specific EFSP (Electronic Filing Service Provider) relationships. No universal API exists. Confidence: High

5. **Settlement funding has minimal API exposure** — Most settlement funding companies (Oasis, etc.) operate through manual or portal-based workflows, not direct APIs. Confidence: Medium

---

## Integration Catalog

### 1. CASE MANAGEMENT / PRACTICE MANAGEMENT

---

#### 1.1 Filevine

**What it does:** Case management platform built for PI and mass tort firms. Deep customization, workflow automation, document management, and reporting.

**Why PI lawyers use it:** Purpose-built for plaintiff-side litigation with phases, deadlines, and document automation tailored to PI workflows.

**API Documentation:** https://developer.filevine.io/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `client_id` | OAuth client identifier |
| `client_secret` | OAuth client secret |
| `personal_access_token` | PAT for API authentication (new gateway) |
| `api_base_url` | Your org's API base URL (visible in Account Manager) |
| `api_integration_user` | Integration user ID |

**How to Obtain:**
1. Navigate to Main Menu > Advanced > API Credentials
2. View API base URL at the top of the Advanced tool
3. Generate Personal Access Token (PAT) in the Access Tokens section
4. Note: Filevine migrated to a new API gateway in August 2024 with PAT-based authentication

**Sandbox/Test Mode:** Yes - sandbox environment available for development

**Notes:** Filevine has best-in-class API documentation for PI-specific case management. Webhooks supported for real-time updates.

---

#### 1.2 Clio Manage

**What it does:** Practice management platform with 250+ integrations. Handles matters, time tracking, billing, client intake, and document management.

**Why PI lawyers use it:** Launched "Clio for Personal Injury Lawyers" in October 2023. Strong integration ecosystem and API support.

**API Documentation:** https://docs.developers.clio.com/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `client_id` | OAuth application client ID |
| `client_secret` | OAuth application secret |
| `redirect_uri` | Your app's OAuth callback URL |
| `access_token` | User's OAuth access token |
| `refresh_token` | Token for refreshing expired access tokens |

**How to Obtain:**
1. Create account at https://developers.clio.com (Clio Manage portal)
2. Create a new application to get client_id and client_secret
3. Implement OAuth flow to get access_token and refresh_token per user

**Sandbox/Test Mode:** Yes - developer sandbox available

**Authorization URL:** https://app.clio.com/oauth/authorize
**Token URL:** https://app.clio.com/oauth/token

**Notes:** Uses standard OAuth 2.0 Authorization Code flow. Supports webhooks. Contact api@clio.com for support.

---

#### 1.3 MyCase

**What it does:** Cloud-based practice management with case tracking, billing, client portal, and document management.

**Why PI lawyers use it:** Practice AI integration for demand letter generation. Quilia integration for treatment tracking.

**API Documentation:** https://mycaseapi.stoplight.io/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | MyCase API key |
| `oauth_client_id` | OAuth client identifier |
| `oauth_client_secret` | OAuth client secret |

**How to Obtain:**
1. Must be on MyCase Advanced subscription tier ($89/month)
2. Contact MyCase support or certified consultants for API access
3. Access API documentation portal for implementation details

**Sandbox/Test Mode:** Yes - test environment available

**Notes:** API access restricted to Advanced tier. Good LawPay reconciliation integration.

---

#### 1.4 SmartAdvocate

**What it does:** Case management built for plaintiff firms. Deep PI workflow support, medical record management, and settlement tracking.

**Why PI lawyers use it:** Purpose-built for PI with 175+ integrations including EvenUp, Compex, and major lien resolution services.

**API Documentation:** Contact SmartAdvocate directly for API documentation

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | SmartAdvocate API key |
| `org_id` | Organization identifier |
| `base_url` | SmartAdvocate instance URL |

**How to Obtain:**
1. SmartAdvocate has an Open API available
2. Contact SmartAdvocate support for API credentials
3. Custom integrations can be developed with SmartAdvocate assistance

**Sandbox/Test Mode:** Contact vendor

**Notes:** Integrates with Zapier, Twilio, Salesforce. Strong third-party ecosystem for PI-specific tools.

---

#### 1.5 Needles/Neos (Assembly Software)

**What it does:** Web-based case management with open API. Native integrations with QuickBooks, Office 365, OneDrive, DocuSign.

**Why PI lawyers use it:** Long-established in PI space, now modernized as cloud platform.

**API Documentation:** Contact Assembly Software for developer access

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | Neos API key |
| `instance_url` | Your Neos instance URL |

**How to Obtain:**
1. Open API available - contact www.needles.com or call 410-363-1976
2. API credentials available through user account portal for existing customers
3. Integrates with Zapier for extended connectivity

**Sandbox/Test Mode:** Contact vendor

---

#### 1.6 CASEpeer

**What it does:** Case management specifically designed for plaintiff PI attorneys. Intake to settlement workflow.

**Why PI lawyers use it:** PI-focused with treatment tracking, settlement calculations, and referral management.

**API Documentation:** Contact CASEpeer for API access

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | CASEpeer API key (created in Account > API Keys) |

**How to Obtain:**
1. API recently introduced
2. Navigate to Account > API Keys to create keys
3. Third-party tools like Tarvent connect via Zapier using API keys

**Sandbox/Test Mode:** Contact vendor

---

#### 1.7 Litify

**What it does:** Legal operating platform built on Salesforce. Enterprise-grade case management with full Salesforce ecosystem access.

**Why PI lawyers use it:** Salesforce reliability with legal-specific tools for matters, billing, and analytics.

**API Documentation:** Uses Salesforce Connected Apps

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `connected_app_name` | Salesforce Connected App name |
| `api_name` | Connected App API name |
| `client_id` | Salesforce Consumer Key |
| `client_secret` | Salesforce Consumer Secret |
| `instance_url` | Salesforce org instance URL |

**How to Obtain:**
1. Log into Litify with admin account
2. Click Setup > Platform Tools > Apps
3. Add new Connected App
4. Email Litify support with System Administrator contact for API authorization

**Sandbox/Test Mode:** Yes - Salesforce sandbox environments available

**Notes:** Full Salesforce API access. Integrates with DocuSign, SharePoint, DropBox, QuickBooks via MuleSoft or native AppExchange apps.

---

#### 1.8 PracticePanther

**What it does:** Practice management with time tracking, billing, client portal, and automation.

**Why PI lawyers use it:** Modern interface, good mobile app, reasonable pricing for smaller firms.

**API Documentation:** https://app.practicepanther.com/content/apidocs/index.html

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `client_id` | OAuth client identifier |
| `client_secret` | OAuth client secret |
| `redirect_uri` | Must be HTTPS |

**How to Obtain:**
1. Submit request for API access to support team
2. Answer preliminary questions
3. Once granted, go to Settings and create your first app
4. Obtain client_id and client_secret from app settings

**Sandbox/Test Mode:** Yes - use ngrok or similar for local HTTPS testing

**Notes:** OAuth 2.0 only. HTTPS redirect URLs required.

---

### 2. COMMUNICATION / SMS / PHONE

---

#### 2.1 Twilio (Reference - Already Built-In)

**What it does:** Cloud communications platform for SMS, voice calls, and messaging.

**Why PI lawyers use it:** Automated appointment reminders, case updates, intake notifications.

**API Documentation:** https://www.twilio.com/docs

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `account_sid` | Twilio Account String Identifier |
| `auth_token` | Primary authentication token |
| `phone_number` | Twilio phone number (E.164 format: +1XXXXXXXXXX) |
| `messaging_service_sid` | Optional - for messaging service routing |

**How to Obtain:**
1. Create account at https://www.twilio.com
2. Find Account SID and Auth Token in Console Dashboard
3. Purchase or port phone numbers in Console

**Sandbox/Test Mode:** Yes - test credentials available, magic phone numbers for testing

**Security Note:** If auth_token is compromised, rotate immediately via Console. Consider using API Keys (preferred) for granular access control.

---

#### 2.2 RingCentral

**What it does:** Enterprise VoIP, video conferencing, team messaging, and fax.

**Why PI lawyers use it:** Seamless integration with legal software, end-to-end encryption, mobility for attorneys.

**API Documentation:** https://developers.ringcentral.com/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `client_id` | OAuth application client ID |
| `client_secret` | OAuth application secret |
| `jwt_token` | For server-to-server JWT auth (preferred for scripts) |
| `redirect_uri` | OAuth callback URL |

**How to Obtain:**
1. Access RingCentral Developer Console
2. Click 'Create App'
3. Note Client ID and Client Secret from app dashboard

**Sandbox/Test Mode:** Yes - sandbox environment available

**Auth Methods:** Auth Code with PKCE (recommended), JWT flow (for scripts/servers)

---

#### 2.3 Dialpad

**What it does:** AI-powered cloud phone system with call intelligence and transcription.

**Why PI lawyers use it:** AI transcription, call analytics, CRM integration.

**API Documentation:** https://developers.dialpad.com/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | Dialpad API key (for internal use) |
| `client_id` | OAuth client identifier |
| `client_secret` | OAuth client secret |
| `redirect_uri` | OAuth callback URL |

**How to Obtain:**
1. Must be Company Admin on Pro or Enterprise plan
2. For internal: Admin Settings > Create API Key
3. For OAuth: Register via developer page for client_id/client_secret

**Sandbox/Test Mode:** Contact vendor

**Notes:** OAuth recommended for multi-tenant apps. Three-legged OAuth flow.

---

### 3. ELECTRONIC SIGNATURE

---

#### 3.1 DocuSign

**What it does:** Electronic signature platform for contracts, retainers, and legal documents.

**Why PI lawyers use it:** Industry standard for e-signatures. Client convenience for retainer agreements.

**API Documentation:** https://developers.docusign.com/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `integration_key` | Also called client_id / API key |
| `secret_key` | OAuth client secret |
| `account_id` | DocuSign account identifier |
| `base_uri` | API base URL for your environment |
| `jwt_user_id` | User ID for JWT authentication |
| `private_key` | RSA private key for JWT auth |

**How to Obtain:**
1. Log into DocuSign developer account
2. Go to Admin > Integrations > Apps and Keys
3. Click Add App and Integration Key
4. Copy integration key (client_id)
5. Click Actions > Edit > Add Secret key

**Sandbox/Test Mode:** Yes - developer sandbox (demo.docusign.net)

**Auth Methods:**
- Authorization Code Grant (web apps)
- PKCE (SPAs/mobile)
- JWT Grant (server-to-server)

**Notes:** Base64 encode client_id:client_secret for auth header.

---

#### 3.2 Dropbox Sign (HelloSign)

**What it does:** Electronic signatures with simple API integration.

**Why PI lawyers use it:** Simpler/cheaper alternative to DocuSign. Good for smaller firms.

**API Documentation:** https://developers.hellosign.com/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | HelloSign API key |
| `client_id` | OAuth application client ID (for OAuth flow) |
| `client_secret` | OAuth application secret |
| `access_token` | OAuth access token (valid ~1 hour) |
| `refresh_token` | For refreshing expired access tokens |

**How to Obtain:**
1. Go to API Settings page in your account
2. Find or create API Key
3. Create API App on API Settings page for OAuth credentials

**Sandbox/Test Mode:** Yes - test mode available

**Auth Methods:**
- API Key (Basic auth - key as username, password blank)
- OAuth access token (Bearer token in header)

---

### 4. ACCOUNTING / BILLING

---

#### 4.1 LawPay / AffiniPay

**What it does:** Legal-specific payment processing with trust account compliance (IOLTA).

**Why PI lawyers use it:** Trust account compliance, client payment portals, integration with case management.

**API Documentation:** https://developers.8am.com/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `public_key` | Identifies you to the payment processor |
| `secret_key` | Authenticates API requests (keep secure!) |
| `account_id` | Credit account ID |
| `echeck_account_id` | eCheck account ID (if applicable) |
| `access_token` | OAuth access token (for OAuth flow) |

**How to Obtain:**
1. Log into https://secure.lawpay.com/login
2. Click your name > Developers
3. Click Authorize Application > select "My Website"
4. Click Show Credentials

**Sandbox/Test Mode:** Yes - test mode available

**Notes:** Requires Administrator or Developer role. Part of 8am/AffiniPay unified platform (includes ClientPay, CPACharge).

---

#### 4.2 QuickBooks Online

**What it does:** Cloud accounting with invoicing, expense tracking, and reporting.

**Why PI lawyers use it:** Industry standard small business accounting. Integrates with most case management systems.

**API Documentation:** https://developer.intuit.com/app/developer/qbo/docs

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `client_id` | OAuth application identifier |
| `client_secret` | OAuth application secret (keep confidential!) |
| `realm_id` | QuickBooks company ID |
| `access_token` | OAuth access token |
| `refresh_token` | Token for refreshing expired access |

**How to Obtain:**
1. Go to https://developer.intuit.com/app/developer/dashboard
2. Sign up or log in
3. Select Create an App > QuickBooks Online
4. Name app, select scope, click Create App
5. Find credentials on Keys & OAuth page

**Sandbox/Test Mode:** Yes - sandbox company available for testing

**Authorization URL:** https://appcenter.intuit.com/connect/oauth2
**Token URL:** https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer

**Notes:** Client secret must be kept very confidential. OAuth 2.0 only.

---

### 5. CLIENT COMMUNICATION PORTALS

---

#### 5.1 Case Status

**What it does:** AI-powered client portal with automated case status updates and messaging.

**Why PI lawyers use it:** Reduces "what's happening with my case?" calls. Automated status updates.

**API Documentation:** Contact Case Status for API access

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | Case Status API key |
| `org_id` | Organization identifier |
| `webhook_secret` | For webhook verification |

**How to Obtain:**
1. Integration built with leading CMS platforms (Clio, Litify, MyCase, Filevine, SmartAdvocate, CASEpeer)
2. Contact Case Status for direct API access
3. Zapier integration available for extended connectivity

**Sandbox/Test Mode:** Contact vendor

---

#### 5.2 Hona

**What it does:** Client communication portal with automated case tracking and educational content.

**Why PI lawyers use it:** Clients track cases "like a package." Reduces repetitive status calls.

**API Documentation:** Contact Hona for API access

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | Hona API key |
| `webhook_url` | For real-time updates |

**How to Obtain:**
1. Hona's dynamic API plugs into CMS (Clio, MyCase, Filevine, HubSpot, PracticePanther, Salesforce)
2. Contact Hona for direct API integration

**Sandbox/Test Mode:** Contact vendor

---

### 6. DEMAND LETTERS / AI LITIGATION TOOLS

---

#### 6.1 EvenUp

**What it does:** AI-powered demand letter generation from medical records and case files.

**Why PI lawyers use it:** Automates demand letter drafting with 250,000+ verdict/settlement data points.

**API Documentation:** Partner integration via case management systems

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | EvenUp API key (via CMS integration) |
| `firm_id` | EvenUp firm identifier |

**How to Obtain:**
1. EvenUp integrates directly with leading case management platforms
2. Sign up at evenuplaw.com
3. Integration syncs case details automatically from CMS

**Sandbox/Test Mode:** Contact vendor

**Notes:** Uses AI to extract medical data, track treatment, and draft demands. Alerts for missing bills/records.

---

### 7. MEDICAL RECORDS RETRIEVAL

---

#### 7.1 Compex Legal Services

**What it does:** Medical record retrieval, document management, and medical canvassing.

**Why PI lawyers use it:** National leader in medical record retrieval. Fast turnaround, affordable pricing.

**API Documentation:** Integration via NEXT Operating System and CMS partnerships

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `portal_login` | Compex portal username |
| `portal_password` | Compex portal password |
| `firm_id` | Firm identifier in Compex system |

**How to Obtain:**
1. Sign up at compexlegal.com
2. SmartAdvocate integration available (March 2025 announced)
3. Integrates with Duck Creek, Guidewire
4. Direct API access via partner relationships

**Sandbox/Test Mode:** Contact vendor

**Notes:** Integration enables placing requests, live status updates, and automatic record upload to CMS.

---

#### 7.2 Record Retrieval Solutions

**What it does:** Medical and billing record retrieval with flat-fee pricing.

**Why PI lawyers use it:** $45 flat fee per request, 15-day average turnaround, HIPAA-compliant.

**API Documentation:** RecordSync via Filevine integration

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | RecordSync API key |
| `firm_id` | RRS firm identifier |

**How to Obtain:**
1. RecordSync integrates with Filevine
2. Contact recordrs.com for integration setup
3. Additional CMS integrations planned

**Sandbox/Test Mode:** Contact vendor

---

### 8. GOOGLE SERVICES

---

#### 8.1 Google Business Profile API (formerly Google My Business)

**What it does:** Manage business listings, reviews, and local presence on Google.

**Why PI lawyers use it:** Local SEO, review management, business information updates.

**API Documentation:** https://developers.google.com/my-business

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `client_id` | OAuth client ID |
| `client_secret` | OAuth client secret |
| `refresh_token` | OAuth refresh token |
| `access_token` | OAuth access token |
| `account_id` | Google Business Profile account ID |
| `location_id` | Specific location identifier |

**How to Obtain:**
1. Go to Google Cloud Console
2. Create project, enable Business Profile APIs
3. Go to Credentials page, Create credentials > OAuth Client ID
4. Configure OAuth consent screen
5. Implement OAuth flow to get tokens

**Sandbox/Test Mode:** No dedicated sandbox - use test accounts

**Notes:** Merchants must complete OAuth consent flow. Platform must cache OAuth credentials.

---

#### 8.2 Google Maps / Places API

**What it does:** Maps, geocoding, place details, and distance calculations.

**Why PI lawyers use it:** Client location services, accident location mapping, distance calculations.

**API Documentation:** https://developers.google.com/maps

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | Google Maps API key |

**How to Obtain:**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Click Create credentials > API key
3. Enable Places API, Maps JavaScript API, etc. in API Library
4. Restrict key to specific APIs and IP addresses

**Sandbox/Test Mode:** No dedicated sandbox - use API key restrictions

**Important Note (March 2025):** Google designated Places API, Directions API, and Distance Matrix as legacy. Pricing calculator includes newer versions with enhanced features.

---

### 9. EMAIL / MARKETING

---

#### 9.1 SendGrid (Twilio)

**What it does:** Transactional and marketing email delivery.

**Why PI lawyers use it:** Reliable email delivery for case updates, newsletters, automated notifications.

**API Documentation:** https://www.twilio.com/docs/sendgrid

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | SendGrid API key |

**How to Obtain:**
1. Log into SendGrid
2. Go to Settings > API Keys > Create API Key
3. Name key and select access level (Full/Custom/Billing)
4. Copy key immediately (only shown once!)

**Sandbox/Test Mode:** Yes - test mode available

**SMTP Config:**
- Host: smtp.sendgrid.net
- Port: 587
- Username: apikey (literal string)
- Password: Your API key

**Notes:** Store API key in environment variables, never in code.

---

#### 9.2 Mailchimp

**What it does:** Email marketing, newsletters, and audience management.

**Why PI lawyers use it:** Client newsletters, marketing campaigns, list management.

**API Documentation:** https://mailchimp.com/developer/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `api_key` | Mailchimp API key (format: xxxxxx-us4) |
| `server_prefix` | Data center suffix from API key (e.g., us4) |
| `list_id` | Audience/list identifier |

**How to Obtain:**
1. Click profile icon > Profile > Extras > API keys
2. Click Create A Key
3. Name key descriptively
4. Copy immediately (only shown once with full key)

**Sandbox/Test Mode:** No dedicated sandbox

**Notes:** Each integration should have its own API key. Server prefix extracted from API key suffix.

---

### 10. SCHEDULING

---

#### 10.1 Calendly

**What it does:** Automated appointment scheduling with calendar integration.

**Why PI lawyers use it:** Client intake scheduling, consultation booking, deposition scheduling.

**API Documentation:** https://developer.calendly.com/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `personal_access_token` | For internal/team apps |
| `client_id` | OAuth client ID (for public apps) |
| `client_secret` | OAuth client secret |
| `webhook_signing_key` | For webhook verification |

**How to Obtain:**
1. Log in to developer.calendly.com
2. Go to My apps > Create new app
3. Enter app name, select Web, choose Sandbox or Production
4. Copy Client ID and Client Secret

**Sandbox/Test Mode:** Yes - Sandbox environment available

**Auth Methods:**
- Personal Access Tokens (internal apps)
- OAuth 2.1 (public apps)

---

### 11. TEAM COMMUNICATION

---

#### 11.1 Slack

**What it does:** Team messaging, channels, and workflow automation.

**Why PI lawyers use it:** Internal team communication, case-specific channels, automation notifications.

**API Documentation:** https://docs.slack.dev/

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `bot_token` | Bot token (xoxb-...) - app identity |
| `user_token` | User token (xoxp-...) - user identity |
| `signing_secret` | For webhook verification |
| `app_id` | Slack app identifier |
| `client_id` | OAuth client ID |
| `client_secret` | OAuth client secret |

**How to Obtain:**
1. Go to api.slack.com > Create New App
2. Select From Scratch, name app, select workspace
3. Go to OAuth & Permissions
4. Add Bot Token Scopes (chat:write, channels:read, etc.)
5. Install to Workspace (requires admin)
6. Copy Bot Token (xoxb-...)

**Sandbox/Test Mode:** Yes - create test workspace

**Notes:** Bot tokens (xoxb-) preferred for stability. User tokens (xoxp-) tied to specific user.

---

#### 11.2 Microsoft Teams

**What it does:** Team collaboration, video calls, and Office 365 integration.

**Why PI lawyers use it:** Common in larger firms with Microsoft ecosystem.

**API Documentation:** https://learn.microsoft.com/en-us/graph/teams-concept-overview

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `client_id` | Azure AD application ID |
| `client_secret` | Azure AD application secret |
| `tenant_id` | Azure AD tenant (use 'common' for multi-tenant) |
| `bot_id` | Bot application ID |

**How to Obtain:**
1. Go to Azure Portal > Azure Active Directory
2. Click App registrations > New registration
3. Create application, note Application (client) ID
4. Go to Certificates & secrets > New client secret
5. Note secret value (only shown once)

**Sandbox/Test Mode:** Yes - Azure AD test tenants available

**Token URL:** https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

---

### 12. COURT E-FILING

---

#### 12.1 Tyler Technologies (Odyssey File & Serve / FileAndServeXpress)

**What it does:** Electronic court filing for jurisdictions using Tyler's platform (IL, IN, MD, TX, CA counties, etc.).

**Why PI lawyers use it:** Required for e-filing in many jurisdictions. 24/7 filing capability.

**API Documentation:** Contact Tyler Technologies or become Springboard certified partner

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `efsp_username` | EFSP account username |
| `efsp_password` | EFSP account password |
| `firm_id` | Firm identifier in Odyssey system |
| `bar_number` | Attorney bar number |
| `jurisdiction_id` | Court jurisdiction identifier |

**How to Obtain:**
1. Must register as Electronic Filing Service Provider (EFSP) or use existing EFSP
2. Create account at court's e-filing portal
3. Firm Administrator completes firm registration
4. API integration via ECF 4 standard (Springboard certified)

**Sandbox/Test Mode:** Yes - test environments per jurisdiction

**Notes:** 44+ Springboard-certified integration partners. Jurisdiction-specific setup required.

---

### 13. AUTOMATION / WORKFLOW

---

#### 13.1 Zapier

**What it does:** No-code workflow automation connecting 5,000+ apps.

**Why PI lawyers use it:** Connect case management, billing, communication tools without custom code.

**API Documentation:** https://zapier.com/apps/webhook/integrations

**Credential Fields:**
| Field | Description |
|-------|-------------|
| `webhook_url` | Zapier-generated webhook URL per Zap |
| `api_key` | For authenticated webhook requests |

**How to Obtain:**
1. Create Zap with webhook trigger
2. Zapier generates unique webhook URL
3. For authenticated requests, pass API keys in headers

**Sandbox/Test Mode:** Yes - test mode in Zap editor

**Notes:** Enterprise-grade security. Use custom Zapier app for encrypted credential storage.

---

## Conflicts & Uncertainties

1. **Medical Records Retrieval APIs** — Most services (Compex, RRS) prefer CMS integrations over direct APIs. Public API documentation is limited. May require partner relationships.

2. **Court E-Filing** — Highly jurisdiction-specific. No universal API. Must work with individual courts or certified EFSPs.

3. **Settlement Funding** — No public APIs found for Oasis, Thrivest, or other funding companies. Workflow is primarily portal-based.

4. **Nuvelo/ProFrac Lien Management** — Search returned no results for "Nuvelo" as a medical lien management service. May be under different name or regional.

5. **SmartAdvocate/Needles API Docs** — Not publicly documented. Requires vendor contact for developer access.

---

## Onnex Implications

For the PI Lawyer OS integrations settings page:

**Priority 1 (Build First):**
- Twilio (already built)
- DocuSign / Dropbox Sign
- LawPay / QuickBooks
- Calendly
- SendGrid/Mailchimp

**Priority 2 (CMS Integrations):**
- Filevine (strongest PI API)
- Clio
- SmartAdvocate
- MyCase

**Priority 3 (Nice-to-Have):**
- Case Status / Hona (client portals)
- EvenUp (demand letters)
- Google Business Profile
- Slack / Teams

**Skip for Now:**
- Court e-filing (too jurisdiction-specific)
- Settlement funding (no APIs)
- Medical records retrieval (work through CMS partnerships)

---

## Recommendations

1. **Use OAuth 2.0 as standard auth pattern** — Most integrations use OAuth. Build a reusable OAuth flow component with token refresh logic.

2. **Store credentials encrypted** — All secrets (client_secret, api_key, auth_token) must be encrypted at rest. Use environment variables or secrets manager.

3. **Build "Test Connection" functionality** — Each integration should have a test endpoint that validates credentials work before saving.

4. **Implement webhook receivers** — Filevine, DocuSign, Calendly, and others support webhooks. Build generic webhook receiver with signature verification.

5. **Create integration status dashboard** — Show connected/disconnected status, last sync time, and error states for each integration.

6. **Start with Filevine integration** — Best API for PI firms, most complete documentation, and matches PI Lawyer OS vertical perfectly.

---

## Sources

| # | URL | Type | Verified | Used For |
|---|-----|------|----------|----------|
| 1 | [Filevine API Authentication](https://developer.filevine.io/docs/v2-us/branches/main/e0f5ad7e2c916-authentication) | Primary | Partial | Filevine auth fields |
| 2 | [Filevine Help Center - API Credentials](https://support.filevine.com/hc/en-us/articles/13644331859611-API-Credentials) | Primary | Yes | Filevine credential setup |
| 3 | [Clio Developer Documentation](https://docs.developers.clio.com/api-docs/authorization/) | Primary | Yes | Clio OAuth flow |
| 4 | [MyCase API Documentation](https://mycaseapi.stoplight.io/) | Primary | Yes | MyCase API access |
| 5 | [SmartAdvocate Integration Partners](https://www.smartadvocate.com/integration-and-partners) | Primary | Yes | SmartAdvocate integrations |
| 6 | [DocuSign Developer](https://developers.docusign.com/) | Primary | Yes | DocuSign auth |
| 7 | [Dropbox Sign Developer](https://developers.hellosign.com/) | Primary | Yes | HelloSign auth |
| 8 | [LawPay Developer](https://developers.8am.com/) | Primary | Yes | LawPay credentials |
| 9 | [QuickBooks Developer](https://developer.intuit.com/) | Primary | Yes | QBO OAuth |
| 10 | [Twilio API Reference](https://www.twilio.com/docs) | Primary | Yes | Twilio auth |
| 11 | [RingCentral Developers](https://developers.ringcentral.com/) | Primary | Yes | RingCentral auth |
| 12 | [Dialpad Developers](https://developers.dialpad.com/) | Primary | Yes | Dialpad auth |
| 13 | [Google Business Profile APIs](https://developers.google.com/my-business) | Primary | Yes | GBP OAuth |
| 14 | [Google Maps Platform](https://developers.google.com/maps) | Primary | Yes | Maps API key |
| 15 | [SendGrid API](https://www.twilio.com/docs/sendgrid) | Primary | Yes | SendGrid auth |
| 16 | [Mailchimp Developer](https://mailchimp.com/developer/) | Primary | Yes | Mailchimp API key |
| 17 | [Calendly Developer](https://developer.calendly.com/) | Primary | Yes | Calendly OAuth |
| 18 | [Slack API](https://docs.slack.dev/) | Primary | Yes | Slack tokens |
| 19 | [Microsoft Teams/Graph](https://learn.microsoft.com/en-us/graph/) | Primary | Yes | Teams OAuth |
| 20 | [Tyler Technologies eFile](https://www.tylertech.com/products/enterprise-justice/efile-serve) | Primary | Yes | Court e-filing |
| 21 | [PracticePanther API](https://support.practicepanther.com/en/articles/479897-practicepanther-api) | Primary | Yes | PracticePanther auth |
| 22 | [CASEpeer](https://www.casepeer.com/) | Primary | Yes | CASEpeer features |
| 23 | [Case Status](https://www.casestatus.com/integrations) | Primary | Yes | Client portal integrations |
| 24 | [Hona](https://www.hona.com/integrations) | Primary | Yes | Client communication |
| 25 | [EvenUp](https://www.evenuplaw.com/) | Primary | Yes | Demand letters |
| 26 | [Compex Legal Services](https://www.compexlegal.com/) | Primary | Yes | Medical records |
| 27 | [Record Retrieval Solutions](https://www.recordrs.com/) | Primary | Yes | Medical records |
| 28 | [Zapier Webhooks](https://zapier.com/apps/webhook/integrations) | Primary | Yes | Webhook automation |
| 29 | [Litify on Salesforce](https://appexchange.salesforce.com/appxListingDetail?listingId=a0N3A00000DvNozUAF) | Primary | Yes | Litify platform |
| 30 | [Quilia PI Software Rankings](https://www.quilia.com/articles/which-personal-injury-case-management-software-is-the-most-popular/) | Secondary | Yes | Market overview |
