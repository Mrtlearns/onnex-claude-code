import { useState, useRef, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { useLlmSettings } from '@/hooks/useLlmSettings';
import { apiFetch, API_BASE, AUTH_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useTTG } from '@/context/TTGContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLang } from '@/i18n';
import { useFirmBranding } from '@/hooks/useAuth';
import { ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helper: POST to PostgREST and return the first created row
// ---------------------------------------------------------------------------
async function createRecord<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`POST ${path} failed: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return (Array.isArray(data) ? data[0] : data) as T;
}

// ---------------------------------------------------------------------------
// Types for counts
// ---------------------------------------------------------------------------
interface DataCounts {
  leads: number;
  cases: number;
  partners: number;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

// ---------------------------------------------------------------------------
// Main Settings page
// ---------------------------------------------------------------------------
const LLM_PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic',  label: 'Anthropic (direct)' },
];

const LLM_MODELS: Record<string, { value: string; label: string }[]> = {
  openrouter: [
    { value: 'auto',           label: 'Auto (best model by task)' },
    { value: 'gpt-4o',         label: 'GPT-4o' },
    { value: 'claude-sonnet',  label: 'Claude Sonnet 4.5' },
    { value: 'gemini-pro',     label: 'Gemini Pro 1.5' },
  ],
  anthropic: [
    { value: 'claude-sonnet', label: 'Claude Sonnet 4.6' },
    { value: 'claude-haiku',  label: 'Claude Haiku 4.5' },
  ],
};

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

interface DocTemplate {
  id: string;
  template_type: string;
  name: string;
  content: string;
  active: boolean;
}

interface Objection {
  id: string;
  category: string;
  objection: string;
  response: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Integration types
// ---------------------------------------------------------------------------
interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  required: boolean;
}

interface IntegrationDef {
  slug: string;
  name: string;
  category: string;
  description: string;
  fields: IntegrationField[];
  docsUrl: string;
  howTo: string;
  iconUrl?: string;
}

interface IntegrationState {
  values: Record<string, string>;
  expanded: boolean;
  saving: boolean;
  testing: boolean;
  status: 'idle' | 'saved' | 'connected' | 'error';
  statusMsg: string;
  showHowTo: boolean;
  showPass: Record<string, boolean>;
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  // ── E-Signature ──────────────────────────────────────────────────────────
  {
    slug: 'docusign', name: 'DocuSign', category: 'E-Signature',
    iconUrl: 'https://logo.clearbit.com/docusign.com',
    description: 'Send retainer agreements and demand letters for e-signature directly from PI Lawyer OS.',
    docsUrl: 'https://developers.docusign.com/',
    howTo: 'Create an integration key in your DocuSign developer account under Apps & Keys. Copy the secret key, account ID, and base URI from the same screen.',
    fields: [
      { key: 'integration_key', label: 'Integration Key', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: '••••••••', required: true },
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'base_uri', label: 'Base URI', type: 'url', placeholder: 'https://na4.docusign.net', required: true },
    ],
  },
  {
    slug: 'dropbox_sign', name: 'Dropbox Sign', category: 'E-Signature',
    iconUrl: 'https://logo.clearbit.com/dropbox.com',
    description: 'Lightweight e-signature via Dropbox Sign (formerly HelloSign) for client agreements.',
    docsUrl: 'https://developers.hellosign.com/',
    howTo: 'Log in to Dropbox Sign, go to API → Settings, and copy your API Key. Use the test mode key for staging.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••', required: true },
    ],
  },
  {
    slug: 'pandadoc', name: 'PandaDoc', category: 'E-Signature',
    iconUrl: 'https://logo.clearbit.com/pandadoc.com',
    description: 'Send intake forms and retainer agreements for e-signature via PandaDoc. Clients sign from any device.',
    docsUrl: 'https://developers.pandadoc.com/',
    howTo: 'In PandaDoc, go to Settings → Integrations → API. Click "Generate API Key". Copy the key — it is shown once. Your workspace ID is in the URL when you log in: app.pandadoc.com/settings/workspace/{id}.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••', required: true },
      { key: 'workspace_id', label: 'Workspace ID', type: 'text', placeholder: 'Optional — leave blank for default workspace', required: false },
    ],
  },
  // ── Payments & Accounting ────────────────────────────────────────────────
  {
    slug: 'lawpay', name: 'LawPay', category: 'Payments & Accounting',
    iconUrl: 'https://logo.clearbit.com/lawpay.com',
    description: 'Accept client payments and IOLTA trust accounting compliant with bar rules.',
    docsUrl: 'https://developers.8am.com/',
    howTo: 'In your LawPay merchant dashboard, go to Settings → API Keys. Copy the public and secret keys. Account ID is shown on the dashboard home.',
    fields: [
      { key: 'public_key', label: 'Public Key', type: 'text', placeholder: 'pk_live_...', required: true },
      { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...', required: true },
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'acct_...', required: true },
    ],
  },
  {
    slug: 'quickbooks', name: 'QuickBooks Online', category: 'Payments & Accounting',
    iconUrl: 'https://logo.clearbit.com/quickbooks.intuit.com',
    description: 'Sync invoices, expenses, and case costs with QuickBooks Online.',
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs',
    howTo: 'Create an app at developer.intuit.com, then use the OAuth 2.0 playground to generate tokens. Copy the Realm ID from your QuickBooks company URL.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'ABcd1234...', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true },
      { key: 'realm_id', label: 'Realm ID', type: 'text', placeholder: '1234567890', required: true },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: '••••••••', required: true },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', placeholder: '••••••••', required: true },
    ],
  },
  // ── Communications ───────────────────────────────────────────────────────
  {
    slug: 'twilio', name: 'Twilio', category: 'Communications',
    iconUrl: 'https://logo.clearbit.com/twilio.com',
    description: 'Send and receive SMS for client communications and automated lead follow-up.',
    docsUrl: 'https://www.twilio.com/docs',
    howTo: 'Log in to console.twilio.com. Your Account SID and Auth Token are on the dashboard home. Buy a phone number and copy it in E.164 format (+15551234567).',
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'auth_token', label: 'Auth Token', type: 'password', placeholder: '••••••••', required: true },
      { key: 'phone_number', label: 'From Phone Number', type: 'text', placeholder: '+15551234567', required: true },
    ],
  },
  {
    slug: 'sendgrid', name: 'SendGrid', category: 'Communications',
    iconUrl: 'https://logo.clearbit.com/sendgrid.com',
    description: 'Transactional email delivery for client communications and automated workflows.',
    docsUrl: 'https://docs.sendgrid.com/api-reference',
    howTo: 'In SendGrid, go to Settings → API Keys → Create API Key. Select "Full Access" or restrict to Mail Send. Copy the key immediately — it is only shown once.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'SG.••••••••', required: true },
      { key: 'from_email', label: 'From Email', type: 'text', placeholder: 'noreply@yourfirm.com', required: true },
      { key: 'from_name', label: 'From Name', type: 'text', placeholder: 'Smith & Associates', required: false },
    ],
  },
  {
    slug: 'ringcentral', name: 'RingCentral', category: 'Communications',
    iconUrl: 'https://logo.clearbit.com/ringcentral.com',
    description: 'VoIP phone calls, SMS, and fax integration for client communications.',
    docsUrl: 'https://developers.ringcentral.com/',
    howTo: 'Create an app at developers.ringcentral.com. Use JWT authentication — generate a JWT credential from the developer console under your app credentials.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true },
      { key: 'jwt_token', label: 'JWT Token', type: 'password', placeholder: '••••••••', required: true },
    ],
  },
  {
    slug: 'gmail', name: 'Gmail / Google Workspace', category: 'Communications',
    iconUrl: 'https://logo.clearbit.com/gmail.com',
    description: 'Send client emails directly from PI Lawyer OS using your firm Gmail or Google Workspace account.',
    docsUrl: 'https://console.cloud.google.com/',
    howTo: 'Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID. Enable the Gmail API. Complete OAuth consent to generate access and refresh tokens. The redirect URI must match exactly.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true },
      { key: 'redirect_uri', label: 'Redirect URI', type: 'url', placeholder: 'https://pil.on-nex.us/auth/google/callback', required: true },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: '••••••••', required: true },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', placeholder: '••••••••', required: true },
    ],
  },
  // ── Scheduling ───────────────────────────────────────────────────────────
  {
    slug: 'calendly', name: 'Calendly', category: 'Scheduling',
    iconUrl: 'https://logo.clearbit.com/calendly.com',
    description: 'Embed scheduling links for consultations and case review meetings.',
    docsUrl: 'https://developer.calendly.com/',
    howTo: 'Go to Calendly → Integrations → API & Webhooks → Personal Access Tokens → Create new token. Organization URI is your Calendly organization URL.',
    fields: [
      { key: 'api_key', label: 'Personal Access Token', type: 'password', placeholder: '••••••••', required: true },
      { key: 'organization_uri', label: 'Organization URI', type: 'url', placeholder: 'https://api.calendly.com/organizations/XXXXXXXX', required: false },
    ],
  },
  {
    slug: 'zapier', name: 'Zapier', category: 'Scheduling',
    iconUrl: 'https://logo.clearbit.com/zapier.com',
    description: 'Connect PI Lawyer OS to 5,000+ apps via Zapier webhooks for custom automations.',
    docsUrl: 'https://zapier.com/apps/webhook/integrations',
    howTo: 'Create a Zap with "Webhooks by Zapier" as the trigger. Select "Catch Hook", copy the webhook URL, and paste it here.',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://hooks.zapier.com/hooks/catch/...', required: true },
    ],
  },
  // ── Case Management ───────────────────────────────────────────────────────
  {
    slug: 'filevine', name: 'Filevine', category: 'Case Management',
    iconUrl: 'https://logo.clearbit.com/filevine.com',
    description: 'Bi-directional sync with Filevine for firms using it as their primary case management system.',
    docsUrl: 'https://developer.filevine.io/',
    howTo: 'In Filevine, go to Account → Integrations → API Keys → Create Personal Access Token. The API base URL is typically https://api.filevineapp.com.',
    fields: [
      { key: 'personal_access_token', label: 'Personal Access Token', type: 'password', placeholder: '••••••••', required: true },
      { key: 'api_base_url', label: 'API Base URL', type: 'url', placeholder: 'https://api.filevineapp.com', required: true },
    ],
  },
  {
    slug: 'clio', name: 'Clio Manage', category: 'Case Management',
    iconUrl: 'https://logo.clearbit.com/clio.com',
    description: 'Sync contacts, matters, and documents with Clio Manage.',
    docsUrl: 'https://docs.developers.clio.com/',
    howTo: 'Create an app at app.clio.com/settings/developer_applications. After OAuth authorization, store the access and refresh tokens returned.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: '••••••••', required: true },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', placeholder: '••••••••', required: true },
    ],
  },
  {
    slug: 'mycase', name: 'MyCase', category: 'Case Management',
    iconUrl: 'https://logo.clearbit.com/mycase.com',
    description: 'Connect with MyCase for case management, billing, and client portal features.',
    docsUrl: 'https://mycaseapi.stoplight.io/',
    howTo: 'In MyCase, go to Settings → Integrations → API Access. Enable API access (requires Advanced plan). Copy your API key and OAuth client ID.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••', required: true },
      { key: 'oauth_client_id', label: 'OAuth Client ID', type: 'text', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', required: true },
    ],
  },
  {
    slug: 'casepeer', name: 'CASEpeer', category: 'Case Management',
    iconUrl: 'https://logo.clearbit.com/casepeer.com',
    description: 'PI-specific case management sync — import cases, medical records, and demand tracking from CASEpeer.',
    docsUrl: 'https://casepeer.zendesk.com/',
    howTo: 'Contact CASEpeer support to enable API access for your account. Your subdomain is the prefix of your CASEpeer login URL (e.g. yourfirm.casepeer.com). API keys are provisioned by their support team.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••', required: true },
      { key: 'subdomain', label: 'Subdomain', type: 'text', placeholder: 'yourfirm.casepeer.com', required: true },
    ],
  },
  // ── Marketing ────────────────────────────────────────────────────────────
  {
    slug: 'scorpion', name: 'Scorpion', category: 'Marketing',
    iconUrl: 'https://logo.clearbit.com/scorpion.co',
    description: 'Import call tracking leads and campaign performance data from Scorpion into PI Lawyer OS.',
    docsUrl: 'https://www.scorpion.co/how-we-help/integrations/',
    howTo: 'Contact your Scorpion account manager to request API access and obtain your API key and account ID. Scorpion provisions these credentials during your onboarding or integration setup session.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••', required: true },
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'Your Scorpion account ID', required: true },
    ],
  },
  {
    slug: 'convertit', name: 'ConvertIT', category: 'Marketing',
    iconUrl: 'https://logo.clearbit.com/convertitmarketing.com',
    description: 'Receive PPC leads from ConvertIT campaigns directly into PI Lawyer OS intake pipeline via webhook.',
    docsUrl: 'https://www.convertitmarketing.com/',
    howTo: 'Contact your ConvertIT account manager and request webhook lead delivery. Provide them with your PI Lawyer OS intake webhook URL. They will configure leads to post directly to your pipeline in real time.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Provided by ConvertIT account manager', required: false },
      { key: 'webhook_secret', label: 'Webhook Signing Secret', type: 'password', placeholder: 'Optional — used to verify incoming lead payloads', required: false },
    ],
  },
  {
    slug: 'piboost', name: 'PI Boost', category: 'Marketing',
    iconUrl: 'https://logo.clearbit.com/piboost.com',
    description: 'Sync Facebook and Instagram ad leads from PI Boost social campaigns directly into your lead pipeline.',
    docsUrl: 'https://www.facebook.com/business/help/leads',
    howTo: 'Log in to your PI Boost dashboard and navigate to Settings → API Access to retrieve your API key. Your Facebook Pixel ID is found in Facebook Ads Manager under Events Manager → Data Sources.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••', required: true },
      { key: 'facebook_pixel_id', label: 'Facebook Pixel ID', type: 'text', placeholder: '1234567890123456', required: false },
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'Your PI Boost account ID', required: false },
    ],
  },
  // ── Productivity ──────────────────────────────────────────────────────────
  {
    slug: 'google_sheets', name: 'Google Sheets', category: 'Productivity',
    iconUrl: 'https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png',
    description: 'Export leads, cases, and settlement data to Google Sheets for reporting and sharing with stakeholders.',
    docsUrl: 'https://developers.google.com/sheets/api',
    howTo: 'In Google Cloud Console, enable the Google Sheets API and create an OAuth 2.0 Client ID (same project as Gmail if applicable). The Spreadsheet ID is the long string in your Google Sheet URL between /d/ and /edit.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true },
      { key: 'redirect_uri', label: 'Redirect URI', type: 'url', placeholder: 'https://pil.on-nex.us/auth/google/callback', required: true },
      { key: 'spreadsheet_id', label: 'Spreadsheet ID', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', required: true },
    ],
  },
];

const INTEGRATION_CATEGORIES = [
  'E-Signature',
  'Payments & Accounting',
  'Communications',
  'Scheduling',
  'Case Management',
  'Marketing',
  'Productivity',
];

export default function Settings() {
  const { data: currentUser } = useCurrentUser();
  const { lang, setLang } = useLang();
  const firmBranding = useFirmBranding();

  // Firm branding edit state
  const [brandLogo, setBrandLogo] = useState(firmBranding?.logo_url || '');
  const [brandColor, setBrandColor] = useState(firmBranding?.primary_color || '#0ea5e9');
  const [brandSig, setBrandSig] = useState(firmBranding?.sms_signature || '— Your Legal Team');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [brandMsg, setBrandMsg] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const { settings: llm, loading: llmLoading, saving: llmSaving, saveResult: llmSaveResult, save: saveLlm } = useLlmSettings();
  const [llmProvider, setLlmProvider] = useState<string>('');
  const [llmModel, setLlmModel]       = useState<string>('');

  // Document templates state
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [tmplLoading, setTmplLoading] = useState(false);
  const [tmplLoaded, setTmplLoaded] = useState(false);
  const [editingTmpl, setEditingTmpl] = useState<Partial<DocTemplate> | null>(null);
  const [tmplSaving, setTmplSaving] = useState(false);
  const [tmplMsg, setTmplMsg] = useState('');

  // Objection library state
  const [objections, setObjections] = useState<Objection[]>([]);
  const [objLoading, setObjLoading] = useState(false);
  const [objLoaded, setObjLoaded] = useState(false);
  const [editingObj, setEditingObj] = useState<Partial<Objection> | null>(null);
  const [objSaving, setObjSaving] = useState(false);
  const [objMsg, setObjMsg] = useState('');

  // Team tab state
  const [teamUsers, setTeamUsers] = useState<StaffUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('paralegal');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [teamMsg, setTeamMsg] = useState('');
  const [teamError, setTeamError] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  // Integrations state
  const [integrationStates, setIntegrationStates] = useState<Record<string, IntegrationState>>(() =>
    Object.fromEntries(
      INTEGRATION_DEFS.map((d) => [
        d.slug,
        { values: {}, expanded: false, saving: false, testing: false, status: 'idle', statusMsg: '', showHowTo: false, showPass: {} },
      ])
    )
  );

  function patchIntegration(slug: string, patch: Partial<IntegrationState>) {
    setIntegrationStates((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));
  }

  async function loadIntegrations() {
    const fid = currentUser?.firm_id;
    if (!fid) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/firms?id=eq.${fid}&select=integrations_config`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) return;
      const rows: { integrations_config: Record<string, { enabled?: boolean; fields?: Record<string, string> }> }[] = await res.json();
      const config = rows[0]?.integrations_config ?? {};
      setIntegrationStates((prev) => {
        const next = { ...prev };
        for (const def of INTEGRATION_DEFS) {
          const saved = config[def.slug];
          if (saved?.fields) {
            next[def.slug] = { ...next[def.slug], values: saved.fields, status: 'saved', statusMsg: '' };
          }
        }
        return next;
      });
    } catch { /* ignore */ }
  }

  async function saveIntegration(slug: string) {
    const fid = currentUser?.firm_id;
    if (!fid) return;
    patchIntegration(slug, { saving: true, statusMsg: '' });
    try {
      const token = getToken();
      const values = integrationStates[slug]?.values ?? {};
      // Fetch current integrations_config, merge slug, PATCH back
      const getRes = await fetch(`${API_BASE}/firms?id=eq.${fid}&select=integrations_config`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const rows: { integrations_config: Record<string, unknown> }[] = getRes.ok ? await getRes.json() : [{ integrations_config: {} }];
      const current = rows[0]?.integrations_config ?? {};
      const merged = { ...current, [slug]: { enabled: true, fields: values } };
      await fetch(`${API_BASE}/firms?id=eq.${fid}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ integrations_config: merged }),
      });
      patchIntegration(slug, { saving: false, status: 'saved', statusMsg: 'Credentials saved.' });
    } catch {
      patchIntegration(slug, { saving: false, status: 'error', statusMsg: 'Save failed.' });
    }
  }

  async function testIntegration(slug: string) {
    patchIntegration(slug, { testing: true, statusMsg: '' });
    try {
      const token = getToken();
      const values = integrationStates[slug]?.values ?? {};
      const res = await fetch(`${AUTH_BASE}/test-integration`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration: slug, credentials: values }),
      });
      const data: { success: boolean; message: string } = await res.json();
      patchIntegration(slug, {
        testing: false,
        status: data.success ? 'connected' : 'error',
        statusMsg: data.message,
      });
    } catch {
      patchIntegration(slug, { testing: false, status: 'error', statusMsg: 'Test request failed.' });
    }
  }

  async function loadTemplates() {
    setTmplLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/document_templates?order=template_type.asc,name.asc`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) { setTemplates(await res.json()); setTmplLoaded(true); }
    } catch { /* ignore */ } finally { setTmplLoading(false); }
  }

  async function saveTemplate(tmpl: Partial<DocTemplate>) {
    setTmplSaving(true);
    setTmplMsg('');
    try {
      const token = getToken();
      if (tmpl.id) {
        await fetch(`${API_BASE}/document_templates?id=eq.${tmpl.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ name: tmpl.name, template_type: tmpl.template_type, content: tmpl.content }),
        });
      } else {
        await fetch(`${API_BASE}/document_templates`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ template_type: tmpl.template_type || 'other', name: tmpl.name, content: tmpl.content }),
        });
      }
      setEditingTmpl(null);
      setTmplMsg('Saved');
      await loadTemplates();
    } catch { setTmplMsg('Save failed'); } finally { setTmplSaving(false); }
  }

  async function saveBranding() {
    setBrandSaving(true);
    setBrandMsg('');
    try {
      const token = getToken();
      const firmId = currentUser?.firm_id ?? null;
      if (!firmId) { setBrandMsg('No firm context'); return; }
      const body: Record<string, unknown> = {
        logo_url: brandLogo || null,
        primary_color: brandColor,
        sms_signature: brandSig,
      };
      if (smtpHost) { body.smtp_host = smtpHost; body.smtp_port = parseInt(smtpPort); body.smtp_user = smtpUser; body.smtp_password = smtpPass; }
      await fetch(`${API_BASE}/firms?id=eq.${firmId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      // Update localStorage firm branding
      const stored = localStorage.getItem('firm');
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem('firm', JSON.stringify({ ...parsed, logo_url: brandLogo || null, primary_color: brandColor, sms_signature: brandSig }));
      }
      setBrandMsg('Branding saved — reload to see changes in sidebar.');
    } catch { setBrandMsg('Save failed'); } finally {
      setBrandSaving(false);
    }
  }

  async function loadObjections() {
    setObjLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/objection_library?order=category.asc,created_at.asc&limit=100`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        setObjections(await res.json());
        setObjLoaded(true);
      }
    } catch { /* ignore */ } finally {
      setObjLoading(false);
    }
  }

  async function saveObjection(obj: Partial<Objection>) {
    setObjSaving(true);
    setObjMsg('');
    try {
      const token = getToken();
      if (obj.id) {
        // Update existing
        await fetch(`${API_BASE}/objection_library?id=eq.${obj.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ category: obj.category, objection: obj.objection, response: obj.response, active: obj.active }),
        });
      } else {
        // Insert new
        await fetch(`${API_BASE}/objection_library`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ category: obj.category || 'general', objection: obj.objection, response: obj.response }),
        });
      }
      setEditingObj(null);
      setObjMsg('Saved');
      await loadObjections();
    } catch { setObjMsg('Save failed'); } finally {
      setObjSaving(false);
    }
  }

  async function loadTeam() {
    setTeamLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${AUTH_BASE}/list-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTeamUsers(await res.json());
    } catch { /* ignore */ } finally {
      setTeamLoading(false);
    }
  }

  async function handleAddUser() {
    setAddingUser(true);
    setTeamMsg('');
    setTeamError('');
    try {
      const token = getToken();
      const res = await fetch(`${AUTH_BASE}/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newUserEmail, name: newUserName, role: newUserRole, password: newUserPassword }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? 'Error');
      setTeamMsg('User created.');
      setNewUserEmail(''); setNewUserName(''); setNewUserPassword('');
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Error');
    } finally {
      setAddingUser(false);
    }
  }

  async function handleToggleActive(userId: string, active: boolean) {
    const token = getToken();
    await fetch(`${AUTH_BASE}/update-user/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active: !active }),
    });
    await loadTeam();
  }

  const isAdmin = currentUser?.role === 'admin';

  // Load integrations config on mount once firm is available
  const integrationsLoaded = useRef(false);
  const currentFirmId = currentUser?.firm_id;
  useEffect(() => {
    if (currentFirmId && !integrationsLoaded.current) {
      integrationsLoaded.current = true;
      loadIntegrations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFirmId]);

  // Sync local state once settings load
  if (!llmLoading && llmProvider === '') {
    setLlmProvider(llm.llm_provider);
    setLlmModel(llm.llm_model);
  }

  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const firmId = currentUser?.firm_id;

  // Fetch current data counts
  async function fetchCounts() {
    if (!firmId) return;
    setCountsLoading(true);
    try {
      const [leadsRes, casesRes, partnersRes] = await Promise.all([
        apiFetch(`${API_BASE}/leads?firm_id=eq.${firmId}&select=id`),
        apiFetch(`${API_BASE}/cases?firm_id=eq.${firmId}&select=id`),
        apiFetch(`${API_BASE}/partners?firm_id=eq.${firmId}&select=id`),
      ]);
      const [leads, cases, partners] = await Promise.all([
        leadsRes.json() as Promise<{ id: string }[]>,
        casesRes.json() as Promise<{ id: string }[]>,
        partnersRes.json() as Promise<{ id: string }[]>,
      ]);
      setCounts({ leads: leads.length, cases: cases.length, partners: partners.length });
    } catch {
      // silently ignore
    } finally {
      setCountsLoading(false);
    }
  }

  // Clear all firm data in FK-safe order
  async function clearAllData() {
    if (!firmId) return;

    // FK-safe deletion order: dependents first, then referenced tables
    const paths = [
      `${API_BASE}/client_users?firm_id=eq.${firmId}`,
      `${API_BASE}/case_settlements?firm_id=eq.${firmId}`,
      `${API_BASE}/settlement_offers?firm_id=eq.${firmId}`,
      `${API_BASE}/case_costs?firm_id=eq.${firmId}`,
      `${API_BASE}/tasks?firm_id=eq.${firmId}`,
      `${API_BASE}/communications?firm_id=eq.${firmId}`,
      `${API_BASE}/medical_providers?firm_id=eq.${firmId}`,
      `${API_BASE}/demand_letters?firm_id=eq.${firmId}`,
      `${API_BASE}/ai_analyses?firm_id=eq.${firmId}`,
      `${API_BASE}/documents?firm_id=eq.${firmId}`,
      `${API_BASE}/partner_referrals?firm_id=eq.${firmId}`,
      `${API_BASE}/cases?firm_id=eq.${firmId}`,
      `${API_BASE}/clients?firm_id=eq.${firmId}`,
      `${API_BASE}/partners?firm_id=eq.${firmId}`,
      `${API_BASE}/leads?firm_id=eq.${firmId}`,
    ];

    for (const path of paths) {
      await apiFetch(path, { method: 'DELETE' });
    }
  }

  // Full demo data generation — always clears first to prevent duplicates
  async function generateDemoData() {
    if (!firmId) return;
    setGenerating(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // ── Clear existing data ────────────────────────────────────────────────
      setStep('Clearing existing data...');
      await clearAllData();

      // ── Partners ──────────────────────────────────────────────────────────
      setStep('Creating partners...');
      const partnerJohnson = await createRecord<{ id: string }>(`${API_BASE}/partners`, {
        firm_id: firmId,
        name: 'Johnson Legal Group',
        partner_type: 'attorney',
        phone: '702-555-0101',
        email: 'referrals@johnsonlegal.demo',
        active: true,
      });
      const partnerVegasSpine = await createRecord<{ id: string }>(`${API_BASE}/partners`, {
        firm_id: firmId,
        name: 'Vegas Spine & Chiro',
        partner_type: 'chiropractor',
        phone: '702-555-0202',
        email: 'intake@vegasspine.demo',
        active: true,
      });
      const partnerKimMD = await createRecord<{ id: string }>(`${API_BASE}/partners`, {
        firm_id: firmId,
        name: 'Dr. Rachel Kim MD',
        partner_type: 'medical',
        phone: '702-555-0303',
        email: 'records@rachelkim.demo',
        active: true,
      });
      await createRecord<{ id: string }>(`${API_BASE}/partners`, {
        firm_id: firmId,
        name: 'NV Regional Medical Center',
        partner_type: 'hospital',
        phone: '702-555-0404',
        email: 'medrecords@nvregional.demo',
        active: true,
      });
      await createRecord<{ id: string }>(`${API_BASE}/partners`, {
        firm_id: firmId,
        name: 'Henderson Chiropractic & Wellness',
        partner_type: 'chiropractor',
        phone: '702-555-0505',
        email: 'intake@hendersonchiro.demo',
        active: true,
      });

      // ── Leads ─────────────────────────────────────────────────────────────
      // 7 leads covering all statuses + 2 resurrection candidates
      setStep('Creating leads...');

      // Signed — will become a case client (Williams)
      const leadWilliams = await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Patricia',
        last_name: 'Williams',
        injury_type: 'auto',
        source: 'google',
        status: 'signed',
        phone: '702-555-1001',
        email: 'pwilliams@email.demo',
        created_at: daysAgoISO(90),
      });

      // Intake-in-progress — will become a case client (Chen)
      const leadChen = await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'James',
        last_name: 'Chen',
        injury_type: 'slip-fall',
        source: 'phone',
        status: 'intake-in-progress',
        phone: '702-555-1003',
        email: 'jchen@email.demo',
        created_at: daysAgoISO(45),
      });

      // New — will become a case client (Rodriguez)
      const leadRodriguez = await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Maria',
        last_name: 'Rodriguez',
        injury_type: 'auto',
        source: 'web-form',
        status: 'new',
        phone: '702-555-1002',
        email: 'mrodriguez@email.demo',
        created_at: daysAgoISO(30),
      });

      // Contacted
      await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Robert',
        last_name: 'Thompson',
        injury_type: 'dog-bite',
        source: 'sms',
        status: 'contacted',
        phone: '702-555-1004',
        email: 'rthompson@email.demo',
        created_at: daysAgoISO(14),
      });

      // Lost
      await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Linda',
        last_name: 'Davis',
        injury_type: 'auto',
        source: 'phone',
        status: 'lost',
        phone: '702-555-1005',
        email: 'ldavis@email.demo',
        created_at: daysAgoISO(60),
      });

      // Resurrection candidate 1 — new, no contact ever (45d old, no comms)
      await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Marcus',
        last_name: 'Park',
        injury_type: 'premises-liability',
        source: 'web-form',
        status: 'new',
        phone: '702-555-1006',
        email: 'mpark@email.demo',
        created_at: daysAgoISO(45),
        // No last_contact_at — never contacted
      });

      // Resurrection candidate 2 — contacted 35 days ago, gone cold (no comms after)
      await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Sofia',
        last_name: 'Torres',
        injury_type: 'auto',
        source: 'referral',
        status: 'contacted',
        phone: '702-555-1007',
        email: 'storres@email.demo',
        created_at: daysAgoISO(38),
        last_contact_at: daysAgoISO(35),
      });

      // Intake-in-progress (Patel — motorcycle accident)
      await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Amir',
        last_name: 'Patel',
        injury_type: 'motorcycle',
        source: 'google',
        status: 'intake-in-progress',
        phone: '702-555-1008',
        email: 'apatel@email.demo',
        created_at: daysAgoISO(7),
      });

      // Contacted (Brooks — dog bite)
      await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Diana',
        last_name: 'Brooks',
        injury_type: 'dog-bite',
        source: 'referral',
        status: 'contacted',
        phone: '702-555-1009',
        email: 'dbrooks@email.demo',
        created_at: daysAgoISO(10),
        last_contact_at: daysAgoISO(5),
      });

      // Signed (Harrison — premises liability, will become pre-litigation case)
      const leadHarrison = await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Marcus',
        last_name: 'Harrison',
        injury_type: 'premises-liability',
        source: 'referral',
        status: 'signed',
        phone: '702-555-1010',
        email: 'mharrison@email.demo',
        created_at: daysAgoISO(545),
      });

      // Signed (Nguyen — auto, will become closed case)
      const leadNguyen = await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Lisa',
        last_name: 'Nguyen',
        injury_type: 'auto',
        source: 'web-form',
        status: 'signed',
        phone: '702-555-1011',
        email: 'lnguyen@email.demo',
        created_at: daysAgoISO(480),
      });

      // New (Gomez — slip and fall, 50 days old, resurrection candidate, never contacted)
      await createRecord<{ id: string }>(`${API_BASE}/leads`, {
        firm_id: firmId,
        first_name: 'Elena',
        last_name: 'Gomez',
        injury_type: 'slip-fall',
        source: 'google',
        status: 'new',
        phone: '702-555-1012',
        email: 'egomez@email.demo',
        created_at: daysAgoISO(50),
      });

      // ── Clients ──────────────────────────────────────────────────────────
      setStep('Creating clients...');
      const clientWilliams = await createRecord<{ id: string }>(`${API_BASE}/clients`, {
        firm_id: firmId,
        first_name: 'Patricia',
        last_name: 'Williams',
        dob: '1985-03-12',
        phone: '702-555-1001',
        email: 'pwilliams@email.demo',
        insurance_carrier: 'State Farm',
        insurance_policy: 'SF-2024-9821',
        insurance_adjuster: 'Jennifer Walsh',
        adjuster_phone: '702-555-9001',
        injury_description: 'Rear-end collision causing whiplash and lumbar strain. Treated at Desert Orthopedics and Vegas Chiro.',
      });
      const clientRodriguez = await createRecord<{ id: string }>(`${API_BASE}/clients`, {
        firm_id: firmId,
        first_name: 'Maria',
        last_name: 'Rodriguez',
        dob: '1990-07-22',
        phone: '702-555-1002',
        email: 'mrodriguez@email.demo',
        insurance_carrier: 'Allstate',
        insurance_policy: 'AL-2024-5543',
        insurance_adjuster: 'Kevin Alvarez',
        adjuster_phone: '702-555-9002',
        injury_description: 'T-bone collision causing cervical disc herniation and left shoulder impingement.',
      });
      const clientChen = await createRecord<{ id: string }>(`${API_BASE}/clients`, {
        firm_id: firmId,
        first_name: 'James',
        last_name: 'Chen',
        dob: '1978-11-05',
        phone: '702-555-1003',
        email: 'jchen@email.demo',
        insurance_carrier: null,
        injury_description: 'Slip and fall on unmarked wet floor at warehouse. Knee and wrist fractures confirmed via MRI.',
      });
      const clientHarrison = await createRecord<{ id: string }>(`${API_BASE}/clients`, {
        firm_id: firmId,
        first_name: 'Marcus',
        last_name: 'Harrison',
        dob: '1975-08-19',
        phone: '702-555-1010',
        email: 'mharrison@email.demo',
        insurance_carrier: 'Progressive',
        insurance_policy: 'PRG-2024-3317',
        insurance_adjuster: 'Angela Torres',
        adjuster_phone: '702-555-9003',
        injury_description: 'Fell through damaged staircase railing at commercial property. Left knee fracture and rotator cuff tear confirmed.',
      });
      const clientNguyen = await createRecord<{ id: string }>(`${API_BASE}/clients`, {
        firm_id: firmId,
        first_name: 'Lisa',
        last_name: 'Nguyen',
        dob: '1988-04-30',
        phone: '702-555-1011',
        email: 'lnguyen@email.demo',
        insurance_carrier: 'GEICO',
        insurance_policy: 'GCO-2023-7724',
        insurance_adjuster: 'Brian Mercer',
        adjuster_phone: '702-555-9004',
        injury_description: 'Rear-end collision at highway speed. Lumbar disc herniation L4-L5. Case fully resolved and closed.',
      });

      // ── Cases ─────────────────────────────────────────────────────────────
      setStep('Creating cases...');
      // Williams — negotiation stage, has settlement chain (fully billedout)
      const caseWilliams = await createRecord<{ id: string }>(`${API_BASE}/cases`, {
        firm_id: firmId,
        lead_id: leadWilliams.id,
        client_id: clientWilliams.id,
        case_number: 'PI-2025-001',
        case_type: 'auto',
        status: 'negotiation',
        date_of_loss: '2024-01-15',
        sol_date: '2026-06-15',
        attorney_fee_pct: 33.33,
        description: 'Rear-end collision at Flamingo Rd & Paradise Rd. Defendant ran red light. Police report confirms fault.',
      });
      // Rodriguez — demand stage
      const caseRodriguez = await createRecord<{ id: string }>(`${API_BASE}/cases`, {
        firm_id: firmId,
        lead_id: leadRodriguez.id,
        client_id: clientRodriguez.id,
        case_number: 'PI-2025-002',
        case_type: 'auto',
        status: 'demand',
        date_of_loss: '2024-04-20',
        sol_date: '2026-09-20',
        attorney_fee_pct: 33.33,
        description: 'T-bone collision at Eastern Ave. Defendant failed to yield at stop sign. Two pedestrian witnesses.',
      });
      // Chen — investigation stage
      const caseChen = await createRecord<{ id: string }>(`${API_BASE}/cases`, {
        firm_id: firmId,
        lead_id: leadChen.id,
        client_id: clientChen.id,
        case_number: 'PI-2025-003',
        case_type: 'slip-fall',
        status: 'investigation',
        date_of_loss: '2025-01-10',
        sol_date: '2027-01-10',
        attorney_fee_pct: 33.33,
        description: 'Slip and fall at Desert Storage facility. No wet floor sign posted. Security footage obtained and preserved.',
      });
      // Harrison — pre-litigation, 18 months in, SOL 6 months out
      const caseHarrison = await createRecord<{ id: string }>(`${API_BASE}/cases`, {
        firm_id: firmId,
        lead_id: leadHarrison.id,
        client_id: clientHarrison.id,
        case_number: 'PI-2025-004',
        case_type: 'premises-liability',
        status: 'pre-litigation',
        date_of_loss: '2024-09-12',
        sol_date: '2026-09-12',
        attorney_fee_pct: 40,
        description: 'Client fell through deteriorated staircase railing at Flamingo Commercial Plaza. Property owner cited for code violations. Filing litigation within 60 days.',
      });
      // Nguyen — closed/settled 4 months ago
      const caseNguyen = await createRecord<{ id: string }>(`${API_BASE}/cases`, {
        firm_id: firmId,
        lead_id: leadNguyen.id,
        client_id: clientNguyen.id,
        case_number: 'PI-2024-009',
        case_type: 'auto',
        status: 'closed',
        date_of_loss: '2023-11-08',
        sol_date: '2025-11-08',
        attorney_fee_pct: 33.33,
        closed_at: daysAgoISO(120),
        description: 'Highway rear-end collision. Liability undisputed. Settled with GEICO at mediation. Disbursement complete.',
      });

      // ── Medical Providers ─────────────────────────────────────────────────
      setStep('Creating medical providers...');
      // Williams (3 providers, fully billed)
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseWilliams.id,
        name: 'Desert Orthopedics', provider_type: 'orthopedic',
        request_status: 'received', lien_amount: 12500,
      });
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseWilliams.id,
        name: 'Vegas Chiro & Rehab', provider_type: 'chiropractic',
        request_status: 'received', lien_amount: 8200,
      });
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseWilliams.id,
        name: 'Sunrise Imaging', provider_type: 'radiology',
        request_status: 'received', lien_amount: 3800,
      });
      // Rodriguez (2 providers, one pending)
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseRodriguez.id,
        name: 'Valley Emergency Hospital', provider_type: 'hospital',
        request_status: 'received', lien_amount: 22000,
      });
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseRodriguez.id,
        name: 'Desert Physical Therapy', provider_type: 'physical_therapy',
        request_status: 'requested', lien_amount: 0,
      });
      // Chen (2 providers)
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseChen.id,
        name: 'Spring Valley Medical Center', provider_type: 'hospital',
        request_status: 'received', lien_amount: 15600,
      });
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseChen.id,
        name: 'Henderson Orthopedic Group', provider_type: 'orthopedic',
        request_status: 'requested', lien_amount: 0,
      });
      // Harrison (3 providers — ortho requested, MRI received, PT not yet requested)
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseHarrison.id,
        name: 'Southwest Orthopedic Surgery Center', provider_type: 'orthopedic',
        request_status: 'requested', lien_amount: 0,
      });
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseHarrison.id,
        name: 'Sunrise MRI & Imaging', provider_type: 'radiology',
        request_status: 'received', lien_amount: 4200,
      });
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseHarrison.id,
        name: 'NV Regional Physical Therapy', provider_type: 'physical_therapy',
        request_status: 'not-requested', lien_amount: 0,
      });
      // Nguyen (2 providers — fully received, case closed)
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseNguyen.id,
        name: 'Southern Hills Hospital', provider_type: 'hospital',
        request_status: 'received', lien_amount: 18500,
      });
      await createRecord(`${API_BASE}/medical_providers`, {
        firm_id: firmId, case_id: caseNguyen.id,
        name: 'Desert Pain & Spine Center', provider_type: 'specialist',
        request_status: 'received', lien_amount: 9800,
      });

      // ── Tasks ─────────────────────────────────────────────────────────────
      setStep('Creating tasks...');
      // Williams — mixed statuses
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseWilliams.id,
        title: 'SOL Deadline Monitor',
        task_type: 'sol', due_date: '2026-06-15', status: 'open',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseWilliams.id,
        title: 'Review and send counter-demand to State Farm',
        task_type: 'demand', due_date: '2026-04-01', status: 'open',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseWilliams.id,
        title: 'Follow up with adjuster Jennifer Walsh re: third offer',
        task_type: 'general', due_date: '2026-03-25', status: 'in-progress',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseWilliams.id,
        title: 'Obtain signed disbursement authorization from client',
        task_type: 'general', due_date: '2026-02-28', status: 'completed',
      });
      // Rodriguez — open tasks
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseRodriguez.id,
        title: 'Request MRI records from Valley Emergency Hospital',
        task_type: 'general', due_date: '2026-04-01', status: 'open',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseRodriguez.id,
        title: 'Prepare and send demand letter to Allstate',
        task_type: 'demand', due_date: '2026-05-01', status: 'open',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseRodriguez.id,
        title: 'Confirm physical therapy treatment plan with Desert PT',
        task_type: 'general', due_date: '2026-04-10', status: 'in-progress',
      });
      // Chen — early investigation tasks
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseChen.id,
        title: 'Complete signed client intake authorization forms',
        task_type: 'general', due_date: '2026-03-30', status: 'open',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseChen.id,
        title: 'Order police/incident report from LVMPD',
        task_type: 'general', due_date: '2026-03-28', status: 'completed',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseChen.id,
        title: 'Preserve security footage (litigation hold letter sent)',
        task_type: 'general', due_date: '2026-03-20', status: 'completed',
      });
      // Harrison — deposition prep + SOL reminder + inspection
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseHarrison.id,
        title: 'Schedule deposition prep session with Marcus Harrison',
        task_type: 'deposition', due_date: '2026-04-15', status: 'open',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseHarrison.id,
        title: 'SOL Deadline Monitor — file suit by September 12, 2026',
        task_type: 'sol', due_date: '2026-09-12', status: 'open',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseHarrison.id,
        title: 'Obtain property inspection report from city code enforcement',
        task_type: 'general', due_date: '2026-04-05', status: 'in-progress',
      });
      // Nguyen — archive/close tasks (completed)
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseNguyen.id,
        title: 'Obtain signed final disbursement authorization',
        task_type: 'general', due_date: '2025-11-15', status: 'completed',
      });
      await createRecord(`${API_BASE}/tasks`, {
        firm_id: firmId, case_id: caseNguyen.id,
        title: 'Archive case file and close matter',
        task_type: 'general', due_date: '2025-11-20', status: 'completed',
      });

      // ── Communications ────────────────────────────────────────────────────
      // NOTE: Do NOT add comms for Park or Torres — they are resurrection candidates.
      // The DB trigger `comm_updates_lead_last_contact` resets last_contact_at on INSERT.
      setStep('Creating communications...');

      // Williams — note + sms + call mix
      const williamsComms = [
        { channel: 'call', direction: 'outbound', message: 'Initial consultation call. Client confirmed liability facts. Retainer signed.' },
        { channel: 'sms', direction: 'outbound', message: 'Hi Patricia, just confirming we received your signed retainer. We\'ll be in touch shortly.' },
        { channel: 'note', direction: 'outbound', message: 'Demand letter sent to State Farm adjuster Jennifer Walsh. Demand: $125,000. Reference: SF-CLAIM-2024-48821.' },
        { channel: 'note', direction: 'inbound', message: 'State Farm initial offer: $45,000. Rejected per client instruction. Counter-demand sent at $95,000.' },
        { channel: 'call', direction: 'inbound', message: 'Jennifer Walsh called. Second offer: $62,000. Informed client — instructed to counter at $85,000.' },
        { channel: 'note', direction: 'outbound', message: 'Defense final offer: $72,000. Client accepted at mediation. Disbursement authorization obtained.' },
      ];
      for (const comm of williamsComms) {
        await createRecord(`${API_BASE}/communications`, {
          firm_id: firmId, lead_id: leadWilliams.id,
          status: 'sent', ...comm,
        });
      }

      // Rodriguez — note + sms
      const rodriguezComms = [
        { channel: 'call', direction: 'outbound', message: 'Initial consultation completed. Liability clear — defendant ran stop sign, 2 pedestrian witnesses confirmed.' },
        { channel: 'sms', direction: 'outbound', message: 'Hi Maria, we\'ve started medical records requests. You\'ll hear from us by Friday.' },
        { channel: 'note', direction: 'outbound', message: 'Medical records request sent to Valley Emergency Hospital and Desert Physical Therapy.' },
        { channel: 'note', direction: 'inbound', message: 'Valley Emergency records received — 3 ER visits, surgery referral, $22,000 in charges.' },
      ];
      for (const comm of rodriguezComms) {
        await createRecord(`${API_BASE}/communications`, {
          firm_id: firmId, lead_id: leadRodriguez.id,
          status: 'sent', ...comm,
        });
      }

      // Chen — investigation phase comms
      const chenComms = [
        { channel: 'call', direction: 'outbound', message: 'Intake call. Client described fall at Desert Storage. No wet floor sign present. Two employees on site.' },
        { channel: 'note', direction: 'outbound', message: 'Scene investigation complete. Security footage preserved via litigation hold. No wet floor sign documented.' },
        { channel: 'note', direction: 'inbound', message: 'Facility owner counsel denied liability. Responding with evidence package — moving to file suit.' },
        { channel: 'sms', direction: 'outbound', message: 'James, we\'ve filed the suit. Next step is discovery. We\'ll schedule a call this week.' },
      ];
      for (const comm of chenComms) {
        await createRecord(`${API_BASE}/communications`, {
          firm_id: firmId, lead_id: leadChen.id,
          status: 'sent', ...comm,
        });
      }

      // Harrison — pre-litigation comms (4)
      const harrisonComms = [
        { channel: 'call', direction: 'outbound', message: 'Initial consultation with Marcus Harrison. Client confirmed staircase collapse at Flamingo Commercial Plaza. Scene photos taken.' },
        { channel: 'note', direction: 'outbound', message: 'Filed litigation hold letter with Flamingo Commercial Plaza management. Demanded preservation of maintenance records and video footage.' },
        { channel: 'sms', direction: 'outbound', message: 'Marcus, we have your MRI results — disc findings support the case. We\'ll call you Monday to discuss next steps.' },
        { channel: 'note', direction: 'inbound', message: 'Property owner pre-litigation offer: $35,000. Rejected per client instruction — will file suit.' },
      ];
      for (const comm of harrisonComms) {
        await createRecord(`${API_BASE}/communications`, {
          firm_id: firmId, lead_id: leadHarrison.id,
          status: 'sent', ...comm,
        });
      }

      // Nguyen — closed case comms (4)
      const nguyenComms = [
        { channel: 'call', direction: 'outbound', message: 'Initial consultation. Lisa confirmed highway rear-end at speed. No contributory fault. Strong liability case.' },
        { channel: 'note', direction: 'outbound', message: 'Demand letter sent to GEICO adjuster Brian Mercer. Demand: $115,000. Policy limits confirmed at $100,000.' },
        { channel: 'note', direction: 'inbound', message: 'GEICO tendered policy limits of $100,000 at mediation. Client accepted. Disbursement scheduled.' },
        { channel: 'sms', direction: 'outbound', message: 'Hi Lisa, your settlement check has been issued. Please come by the office this week to sign final documents.' },
      ];
      for (const comm of nguyenComms) {
        await createRecord(`${API_BASE}/communications`, {
          firm_id: firmId, lead_id: leadNguyen.id,
          status: 'sent', ...comm,
        });
      }

      // ── Documents ─────────────────────────────────────────────────────────
      setStep('Creating documents...');
      // Williams (4 docs)
      for (const [name, doc_type] of [
        ['Signed Retainer Agreement — Williams', 'retainer'],
        ['Police Report — Flamingo Rd Collision', 'other'],
        ['Desert Orthopedics — Medical Records', 'medical'],
        ['Demand Letter to State Farm — $125,000', 'correspondence'],
      ] as [string, string][]) {
        await createRecord(`${API_BASE}/documents`, { firm_id: firmId, case_id: caseWilliams.id, name, file_path: '#', doc_type });
      }
      // Rodriguez (3 docs)
      for (const [name, doc_type] of [
        ['Signed Retainer Agreement — Rodriguez', 'retainer'],
        ['Valley Emergency Hospital — Medical Records', 'medical'],
        ['Demand Letter to Allstate — $95,000', 'correspondence'],
      ] as [string, string][]) {
        await createRecord(`${API_BASE}/documents`, { firm_id: firmId, case_id: caseRodriguez.id, name, file_path: '#', doc_type });
      }
      // Chen (4 docs)
      for (const [name, doc_type] of [
        ['Signed Retainer Agreement — Chen', 'retainer'],
        ['Desert Storage Incident Report', 'other'],
        ['Spring Valley Medical Center — Records', 'medical'],
        ['Security Footage Preservation Notice', 'correspondence'],
      ] as [string, string][]) {
        await createRecord(`${API_BASE}/documents`, { firm_id: firmId, case_id: caseChen.id, name, file_path: '#', doc_type });
      }
      // Harrison (4 docs)
      for (const [name, doc_type] of [
        ['Signed Retainer Agreement — Harrison', 'retainer'],
        ['Sunrise MRI Report — Left Knee and Shoulder', 'medical'],
        ['City Code Violation Report — Flamingo Plaza', 'other'],
        ['Pre-Litigation Demand Letter to Progressive', 'correspondence'],
      ] as [string, string][]) {
        await createRecord(`${API_BASE}/documents`, { firm_id: firmId, case_id: caseHarrison.id, name, file_path: '#', doc_type });
      }
      // Nguyen (4 docs)
      for (const [name, doc_type] of [
        ['Signed Retainer Agreement — Nguyen', 'retainer'],
        ['Southern Hills Hospital — Medical Records', 'medical'],
        ['Settlement Agreement and Release — $100,000', 'settlement'],
        ['Final Disbursement Statement', 'settlement'],
      ] as [string, string][]) {
        await createRecord(`${API_BASE}/documents`, { firm_id: firmId, case_id: caseNguyen.id, name, file_path: '#', doc_type });
      }

      // ── Demand Letter (Rodriguez — demand stage) ──────────────────────────
      setStep('Creating demand letter...');
      await createRecord(`${API_BASE}/demand_letters`, {
        firm_id: firmId,
        case_id: caseRodriguez.id,
        content: `RE: DEMAND FOR COMPENSATION\n\nClaimant: Maria Rodriguez\nDate of Loss: April 20, 2024\nClaim No.: AL-2024-5543\n\nDear Mr. Alvarez,\n\nThis office represents Maria Rodriguez in connection with the above-referenced motor vehicle accident. Our client sustained serious injuries as a direct result of the negligence of your insured.\n\nFACTS OF THE INCIDENT\n\nOn April 20, 2024, our client was traveling lawfully when your insured failed to yield at a stop sign and struck her vehicle in a T-bone collision. Two pedestrian witnesses confirmed sole liability of your insured.\n\nINJURIES AND TREATMENT\n\nMs. Rodriguez suffered cervical disc herniation at C5-C6 and left shoulder impingement requiring surgical consultation. She received emergency care at Valley Emergency Hospital ($22,000) and continues treatment with Desert Physical Therapy.\n\nDEMAND\n\nBased on the foregoing, we hereby demand the total sum of $95,000 in full and final settlement of all claims. This demand will remain open for thirty (30) days from the date of this letter.\n\nPlease direct all correspondence to this office.\n\nSincerely,\n[Attorney Name]\n[Firm Name]`,
      });

      // ── Settlement Offers (Williams — full negotiation chain) ──────────────
      setStep('Creating settlement chain...');
      const offersData = [
        { offer_by: 'defense', amount: 45000, offered_at: '2025-12-01T00:00:00Z', accepted: false, notes: 'Initial lowball offer from State Farm.' },
        { offer_by: 'plaintiff', amount: 125000, offered_at: '2025-12-15T00:00:00Z', accepted: false, notes: 'Demand letter amount.' },
        { offer_by: 'defense', amount: 62000, offered_at: '2026-01-10T00:00:00Z', accepted: false, notes: 'Second offer — below floor.' },
        { offer_by: 'plaintiff', amount: 85000, offered_at: '2026-01-20T00:00:00Z', accepted: false, notes: 'Counter — adjusted for documented specials.' },
        { offer_by: 'defense', amount: 72000, offered_at: '2026-02-05T00:00:00Z', accepted: true, notes: 'Final offer accepted at mediation.' },
      ];
      for (const offer of offersData) {
        await createRecord(`${API_BASE}/settlement_offers`, {
          firm_id: firmId, case_id: caseWilliams.id, ...offer,
        });
      }

      // Rodriguez — demand sent, one offer received
      await createRecord(`${API_BASE}/settlement_offers`, {
        firm_id: firmId, case_id: caseRodriguez.id,
        offer_by: 'plaintiff', amount: 95000,
        offered_at: '2026-03-01T00:00:00Z', accepted: false,
        notes: 'Initial demand to Allstate based on medicals + wage loss.',
      });

      // Nguyen — 3-offer chain (settled at policy limits)
      for (const offer of [
        { offer_by: 'defense', amount: 35000, offered_at: daysAgoISO(180), accepted: false, notes: 'GEICO initial offer — well below medicals.' },
        { offer_by: 'plaintiff', amount: 115000, offered_at: daysAgoISO(165), accepted: false, notes: 'Counter-demand based on policy limits and specials.' },
        { offer_by: 'defense', amount: 100000, offered_at: daysAgoISO(125), accepted: true, notes: 'GEICO tendered policy limits at mediation. Accepted.' },
      ]) {
        await createRecord(`${API_BASE}/settlement_offers`, {
          firm_id: firmId, case_id: caseNguyen.id, ...offer,
        });
      }

      // ── Case Costs ────────────────────────────────────────────────────────
      setStep('Creating case costs...');
      // Williams — all costs documented
      const williamsCosts = [
        { cost_type: 'medical_lien', description: 'Desert Orthopedics lien', amount: 12500, paid: true },
        { cost_type: 'medical_lien', description: 'Vegas Chiro & Rehab lien', amount: 8200, paid: false },
        { cost_type: 'medical_lien', description: 'Sunrise Imaging lien', amount: 3800, paid: false },
        { cost_type: 'filing_fee', description: 'Clark County District Court filing fee', amount: 435, paid: true },
        { cost_type: 'expert_fee', description: 'Accident reconstruction expert — Dr. Timothy Cole', amount: 3500, paid: false },
        { cost_type: 'investigation', description: 'Scene documentation and photography', amount: 850, paid: true },
      ];
      for (const cost of williamsCosts) {
        await createRecord(`${API_BASE}/case_costs`, {
          firm_id: firmId, case_id: caseWilliams.id, ...cost,
        });
      }
      // Rodriguez — early costs
      const rodriguezCosts = [
        { cost_type: 'investigation', description: 'Accident scene photos and witness statements', amount: 600, paid: true },
        { cost_type: 'filing_fee', description: 'Clark County filing fee', amount: 435, paid: false },
      ];
      for (const cost of rodriguezCosts) {
        await createRecord(`${API_BASE}/case_costs`, {
          firm_id: firmId, case_id: caseRodriguez.id, ...cost,
        });
      }
      // Chen — preservation costs
      await createRecord(`${API_BASE}/case_costs`, {
        firm_id: firmId, case_id: caseChen.id,
        cost_type: 'investigation', description: 'Security footage preservation and scene documentation', amount: 750, paid: true,
      });
      // Nguyen — all costs paid (closed case)
      for (const cost of [
        { cost_type: 'medical_lien', description: 'Southern Hills Hospital lien', amount: 18500, paid: true },
        { cost_type: 'medical_lien', description: 'Desert Pain & Spine Center lien', amount: 9800, paid: true },
        { cost_type: 'filing_fee', description: 'Clark County filing fee', amount: 435, paid: true },
        { cost_type: 'investigation', description: 'Accident reconstruction report', amount: 1200, paid: true },
      ]) {
        await createRecord(`${API_BASE}/case_costs`, {
          firm_id: firmId, case_id: caseNguyen.id, ...cost,
        });
      }

      // ── Case Settlements ──────────────────────────────────────────────────
      setStep('Creating case settlements...');
      await createRecord(`${API_BASE}/case_settlements`, {
        firm_id: firmId,
        case_id: caseWilliams.id,
        gross_settlement: 72000,
        attorney_fee_pct: 33.33,
        costs_total: 29285,
        settled_at: '2026-02-10T00:00:00Z',
        notes: 'Settled at mediation on Feb 10. Client approved disbursement. Fee: $23,998. Costs: $29,285. Client net: $18,717.',
      });
      await createRecord(`${API_BASE}/case_settlements`, {
        firm_id: firmId,
        case_id: caseNguyen.id,
        gross_settlement: 100000,
        attorney_fee_pct: 33.33,
        costs_total: 29935,
        settled_at: daysAgoISO(120),
        notes: 'Policy limits settlement. Fee: $33,330. Costs: $29,935. Client net: $36,735. Disbursement complete.',
      });

      // ── Partner Referrals ─────────────────────────────────────────────────
      setStep('Creating partner referrals...');
      // Johnson referred Rodriguez (attorney referral, commission owed)
      await createRecord(`${API_BASE}/partner_referrals`, {
        firm_id: firmId,
        partner_id: partnerJohnson.id,
        lead_id: leadRodriguez.id,
        commission_pct: 25,
        commission_amount: 0,
        commission_paid: false,
        notes: 'Referred via attorney network meeting. High-value case.',
      });
      // Johnson referred Williams (paid — case settled)
      await createRecord(`${API_BASE}/partner_referrals`, {
        firm_id: firmId,
        partner_id: partnerJohnson.id,
        case_id: caseWilliams.id,
        commission_pct: 0,
        commission_amount: 2000,
        commission_paid: true,
        notes: 'Flat referral fee paid at settlement. Check #1042.',
      });
      // Vegas Spine referred Chen (chiro partner referral)
      await createRecord(`${API_BASE}/partner_referrals`, {
        firm_id: firmId,
        partner_id: partnerVegasSpine.id,
        lead_id: leadChen.id,
        commission_pct: 0,
        commission_amount: 0,
        commission_paid: false,
        notes: 'Patient referred from chiro intake — slip and fall.',
      });
      // Dr. Kim referred Williams for imaging referrals
      await createRecord(`${API_BASE}/partner_referrals`, {
        firm_id: firmId,
        partner_id: partnerKimMD.id,
        case_id: caseWilliams.id,
        commission_pct: 0,
        commission_amount: 500,
        commission_paid: false,
        notes: 'Expert review fee for radiology interpretation.',
      });

      // ── Portal Account (Williams) ──────────────────────────────────────────
      setStep('Creating client portal account...');
      try {
        const token = getToken();
        const portalHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) portalHeaders['Authorization'] = `Bearer ${token}`;
        await fetch(`${AUTH_BASE}/portal-register`, {
          method: 'POST',
          headers: portalHeaders,
          body: JSON.stringify({
            client_id: clientWilliams.id,
            email: 'portal@williams.demo',
            password: 'Portal2026!',
          }),
        });
        // Non-fatal: if portal user already exists, ignore
      } catch {
        // Portal registration errors don't block demo generation
      }

      setStep('');
      setSuccessMsg(
        'Demo data generated: 5 partners · 12 leads (incl. 3 resurrection candidates) · 5 clients · 5 cases (investigation/demand/negotiation/pre-litigation/closed) · 14 medical providers · 15 tasks · 26 communications · 9 settlement offers · 13 costs · 2 settlements · 19 documents · 1 demand letter · 4 referrals · 1 portal account (portal@williams.demo / Portal2026!).',
      );
      await fetchCounts();
    } catch (err) {
      setStep('');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error during generation.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    setSuccessMsg('');
    setErrorMsg('');
    await generateDemoData();
  }

  async function handleClearAll() {
    const confirmed = window.prompt('Type CLEAR to confirm deletion of all firm data:');
    if (confirmed !== 'CLEAR') {
      if (confirmed !== null) window.alert('Confirmation text did not match. No data deleted.');
      return;
    }
    setGenerating(true);
    setSuccessMsg('');
    setErrorMsg('');
    setStep('Clearing all data...');
    try {
      await clearAllData();
      setCounts({ leads: 0, cases: 0, partners: 0 });
      setSuccessMsg('All firm data has been cleared.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error clearing data.');
    } finally {
      setGenerating(false);
      setStep('');
    }
  }

  const { ttgRunning, ttgConfig, setTtgConfig, ttgStats, ttgLog, ttgRuntime, startTtg, stopTtg } = useTTG();

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and firm configuration.</p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Current session user and firm details.</CardDescription>
        </CardHeader>
        <CardContent>
          {currentUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-28 shrink-0">Email</span>
                <span className="text-sm font-medium text-slate-900">{currentUser.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-28 shrink-0">Name</span>
                <span className="text-sm font-medium text-slate-900">{currentUser.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-28 shrink-0">Role</span>
                <Badge variant="secondary" className="capitalize">{currentUser.role}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-28 shrink-0">Firm</span>
                <span className="text-sm font-medium text-slate-900">{currentUser.firm_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-28 shrink-0">Firm ID</span>
                <span className="text-xs font-mono text-slate-400">{currentUser.firm_id}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Loading user...</p>
          )}
        </CardContent>
      </Card>

      {/* LLM / AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Assistant — LLM</CardTitle>
          <CardDescription>
            Configure which language model powers Wyatt, the firm's AI operations assistant.
            Changes are written to the OpenClaw config and take effect after a container restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {llmLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Provider</label>
                  <Select
                    value={llmProvider}
                    onValueChange={v => { setLlmProvider(v); setLlmModel(LLM_MODELS[v]?.[0]?.value ?? 'auto'); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Model</label>
                  <Select value={llmModel} onValueChange={setLlmModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(LLM_MODELS[llmProvider] ?? []).map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {llmSaveResult && (
                <div className={`rounded-md px-4 py-3 border text-sm ${llmSaveResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {llmSaveResult.msg}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => saveLlm({ llm_provider: llmProvider, llm_model: llmModel })}
                  disabled={llmSaving}
                >
                  {llmSaving ? 'Saving…' : 'Save & Apply'}
                </Button>
                <span className="text-xs text-slate-400">
                  Current: <span className="font-mono">{llm.llm_provider}/{llm.llm_model}</span>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo Data */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Data</CardTitle>
          <CardDescription>
            Generate a complete realistic dataset to explore all platform features —
            leads, cases, clients, partners, tasks, financials, portal, and more.
            Regenerating always clears existing data first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Data status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500">Current data:</span>
            {countsLoading ? (
              <span className="text-sm text-slate-400">Loading...</span>
            ) : counts !== null ? (
              <>
                <Badge variant="outline">{counts.leads} leads</Badge>
                <Badge variant="outline">{counts.cases} cases</Badge>
                <Badge variant="outline">{counts.partners} partners</Badge>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={fetchCounts}>
                Check counts
              </Button>
            )}
          </div>

          {/* Progress indicator */}
          {generating && step && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-3">
              <svg className="animate-spin h-4 w-4 text-blue-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-blue-700">{step}</span>
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-sm text-green-800">{successMsg}</p>
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-800">{errorMsg}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Generating...' : 'Generate Demo Data'}
            </Button>

            <Button
              variant="destructive"
              disabled={generating}
              onClick={handleClearAll}
            >
              Clear All Data
            </Button>
          </div>

          <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-slate-600">What gets generated:</p>
            <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
              <li>5 partners (attorney, chiropractor ×2, medical, hospital)</li>
              <li>12 leads — all statuses including 3 resurrection candidates (Park, Torres, Gomez)</li>
              <li>5 clients with full insurance details</li>
              <li>5 cases covering all stages: investigation · demand · negotiation · pre-litigation · closed</li>
              <li>14 medical providers, 15 tasks, 26 communications (note/call/sms/email)</li>
              <li>19 documents across all 5 cases (retainer, medical, police report, settlement)</li>
              <li>Demand letter on Rodriguez case · 5-offer chain on Williams · policy-limits settlement on Nguyen</li>
              <li>9 settlement offers · 13 costs · 2 completed settlements with disbursement detail</li>
              <li>4 partner referrals with commission tracking</li>
              <li>Portal account: <span className="font-mono">portal@williams.demo</span> / <span className="font-mono">Portal2026!</span> (firm: demo)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Temporal Test Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Temporal Test Generator</CardTitle>
          <CardDescription>
            Simulate realistic PI firm lifecycle events in real time — new leads, medical updates, settlement activity, and more.
            Ideal for demos, walkthroughs, and stress-testing the UI. Generate demo data first for best results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Config row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Tick every</label>
              <Select value={String(ttgConfig.tickInterval)} onValueChange={v => setTtgConfig(c => ({ ...c, tickInterval: Number(v) }))} disabled={ttgRunning}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 seconds</SelectItem>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Sim speed</label>
              <Select value={String(ttgConfig.simDaysPerTick)} onValueChange={v => setTtgConfig(c => ({ ...c, simDaysPerTick: Number(v) }))} disabled={ttgRunning}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day / tick</SelectItem>
                  <SelectItem value="7">7 days / tick</SelectItem>
                  <SelectItem value="30">30 days / tick</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Run for</label>
              <Select value={String(ttgConfig.durationMinutes)} onValueChange={v => setTtgConfig(c => ({ ...c, durationMinutes: Number(v) }))} disabled={ttgRunning}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="0">Until stopped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Intensity</label>
              <Select value={ttgConfig.intensity} onValueChange={v => setTtgConfig(c => ({ ...c, intensity: v as 'quiet' | 'normal' | 'busy' }))} disabled={ttgRunning}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiet">Quiet (1–2 / tick)</SelectItem>
                  <SelectItem value="normal">Normal (3–5 / tick)</SelectItem>
                  <SelectItem value="busy">Busy (5–8 / tick)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scenario toggles */}
          <div className="flex flex-wrap gap-4">
            {([
              ['newLeads', 'New Leads'],
              ['medicalUpdates', 'Medical Updates'],
              ['settlementActivity', 'Settlement Activity'],
              ['caseUpdates', 'Case Updates'],
              ['partnerReferrals', 'Partner Referrals'],
            ] as [keyof typeof ttgConfig, string][]).map(([key, label]) => (
              <label key={key} className={`flex items-center gap-1.5 text-xs cursor-pointer select-none${ttgRunning ? ' opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="checkbox"
                  checked={ttgConfig[key] as boolean}
                  onChange={e => setTtgConfig(c => ({ ...c, [key]: e.target.checked }))}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>

          {/* Start / Stop */}
          <div className="flex items-center gap-3">
            <Button
              onClick={ttgRunning ? stopTtg : () => { if (firmId) startTtg(firmId); }}
              className={ttgRunning ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}
              disabled={!firmId}
            >
              {ttgRunning ? 'Stop Generator' : 'Start Generator'}
            </Button>
            {ttgRunning && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-700 font-medium">Running</span>
              </div>
            )}
          </div>

          {/* Stats bar */}
          {(ttgRunning || ttgLog.length > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-600">
              <span>Events generated: <strong className="text-slate-900">{ttgStats.events}</strong></span>
              <span>Simulated days: <strong className="text-slate-900">{ttgStats.simDays}</strong></span>
              {ttgRunning && <span>Running: <strong className="text-slate-900">{ttgRuntime}</strong></span>}
            </div>
          )}

          {/* Event log */}
          {ttgLog.length > 0 && (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">
                Event Log — latest first (max 25)
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {ttgLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 px-3 py-2">
                    <span className="text-xs font-mono text-slate-400 shrink-0 w-16">{entry.time}</span>
                    <span className="text-sm shrink-0">{entry.icon}</span>
                    <span className="text-xs text-slate-700">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle>Interface Language</CardTitle>
          <CardDescription>Choose the display language for the platform UI.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={lang} onValueChange={(v) => setLang(v as 'en' | 'es')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-slate-400">Reloads immediately — no restart required.</span>
          </div>
        </CardContent>
      </Card>

      {/* Team — admin only */}
      {/* Firm Branding */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Firm Branding</CardTitle>
            <CardDescription>Logo, primary color, and SMS signature used across the platform and outbound messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Logo URL</Label>
                <Input className="h-8 text-sm" value={brandLogo} onChange={(e) => setBrandLogo(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Primary Color</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-gray-200 p-0.5" />
                  <Input className="h-8 text-sm flex-1" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">SMS Signature</Label>
                <Input className="h-8 text-sm" value={brandSig} onChange={(e) => setBrandSig(e.target.value)} placeholder="— Your Law Firm" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">SMTP Email (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Host</Label>
                  <Input className="h-8 text-sm" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input className="h-8 text-sm" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Username</Label>
                  <Input className="h-8 text-sm" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="noreply@firm.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input className="h-8 text-sm" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="App password" />
                </div>
              </div>
            </div>
            {brandMsg && <p className="text-xs text-green-600">{brandMsg}</p>}
            <Button onClick={saveBranding} disabled={brandSaving}>
              {brandSaving ? 'Saving...' : 'Save Branding'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Objection Library */}
      <Card>
        <CardHeader>
          <CardTitle>Objection Library</CardTitle>
          <CardDescription>Common intake objections and staff-approved responses. Wyatt uses these in conversations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!objLoaded && (
            <Button variant="outline" size="sm" onClick={loadObjections} disabled={objLoading}>
              {objLoading ? 'Loading...' : 'Load Objections'}
            </Button>
          )}
          {objLoaded && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{objections.length} objections</span>
                <Button size="sm" variant="outline" onClick={() => setEditingObj({ category: 'general', objection: '', response: '', active: true })}>
                  + Add Objection
                </Button>
              </div>
              {objMsg && <p className="text-xs text-green-600">{objMsg}</p>}

              {/* Edit form */}
              {editingObj !== null && (
                <div className="border border-blue-200 rounded-lg p-3 space-y-3 bg-blue-50">
                  <p className="text-xs font-semibold text-blue-700">{editingObj.id ? 'Edit Objection' : 'New Objection'}</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Input
                      className="h-8 text-sm"
                      value={editingObj.category || ''}
                      onChange={(e) => setEditingObj({ ...editingObj, category: e.target.value })}
                      placeholder="e.g. money, time, fault"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Objection</Label>
                    <Input
                      className="h-8 text-sm"
                      value={editingObj.objection || ''}
                      onChange={(e) => setEditingObj({ ...editingObj, objection: e.target.value })}
                      placeholder="What the client says"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Response</Label>
                    <textarea
                      className="w-full text-sm border border-gray-200 rounded px-3 py-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={editingObj.response || ''}
                      onChange={(e) => setEditingObj({ ...editingObj, response: e.target.value })}
                      placeholder="Approved staff response"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveObjection(editingObj)} disabled={objSaving || !editingObj.objection || !editingObj.response}>
                      {objSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingObj(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Objection list */}
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {objections.map((obj) => (
                  <div key={obj.id} className="px-3 py-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 shrink-0">{obj.category}</span>
                          {!obj.active && <span className="text-xs text-red-400">inactive</span>}
                        </div>
                        <p className="font-medium text-gray-800 text-xs truncate">{obj.objection}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{obj.response}</p>
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-xs shrink-0"
                        onClick={() => setEditingObj({ ...obj })}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>Manage staff user accounts for this firm.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* User list */}
            <div>
              <Button variant="outline" size="sm" onClick={loadTeam} disabled={teamLoading}>
                {teamLoading ? 'Loading...' : 'Load Team'}
              </Button>
              {teamUsers.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Name</th>
                        <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Email</th>
                        <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Role</th>
                        <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Status</th>
                        <th className="text-left text-xs text-gray-500 font-medium pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamUsers.map((u) => (
                        <tr key={u.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 pr-4 font-medium text-gray-900">{u.name}</td>
                          <td className="py-2 pr-4 text-gray-500">{u.email}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                          </td>
                          <td className="py-2 pr-4">
                            <span className={u.active ? 'text-green-600 text-xs font-medium' : 'text-red-500 text-xs font-medium'}>
                              {u.active ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="py-2">
                            {u.id !== currentUser?.id && (
                              <Button
                                size="sm"
                                variant={u.active ? 'destructive' : 'outline'}
                                onClick={() => handleToggleActive(u.id, u.active)}
                              >
                                {u.active ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add user form */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Add Staff User</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="jane@firm.com" type="email" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="attorney">Attorney</SelectItem>
                      <SelectItem value="paralegal">Paralegal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Temp Password</Label>
                  <Input value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Temp2026!" type="password" />
                </div>
              </div>
              {teamMsg && <p className="text-xs text-green-600">{teamMsg}</p>}
              {teamError && <p className="text-xs text-red-500">{teamError}</p>}
              <Button onClick={handleAddUser} disabled={addingUser || !newUserEmail || !newUserName || !newUserPassword}>
                {addingUser ? 'Creating...' : 'Add User'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Document Templates</CardTitle>
          <CardDescription>Retainer, engagement letter, and LOI templates with variable placeholders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tmplLoaded && (
            <Button variant="outline" size="sm" onClick={loadTemplates} disabled={tmplLoading}>
              {tmplLoading ? 'Loading...' : 'Load Templates'}
            </Button>
          )}
          {tmplLoaded && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{templates.length} templates</span>
                <Button size="sm" variant="outline" onClick={() => setEditingTmpl({ template_type: 'other', name: '', content: '' })}>
                  + Add Template
                </Button>
              </div>
              {tmplMsg && <p className="text-xs text-green-600">{tmplMsg}</p>}

              {editingTmpl !== null && (
                <div className="border border-blue-200 rounded-lg p-3 space-y-3 bg-blue-50">
                  <p className="text-xs font-semibold text-blue-700">{editingTmpl.id ? 'Edit Template' : 'New Template'}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Input className="h-8 text-sm" value={editingTmpl.template_type || ''} onChange={(e) => setEditingTmpl({ ...editingTmpl, template_type: e.target.value })} placeholder="retainer, engagement_letter, loi" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input className="h-8 text-sm" value={editingTmpl.name || ''} onChange={(e) => setEditingTmpl({ ...editingTmpl, name: e.target.value })} placeholder="Template name" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Content (Markdown / HTML, use {'{{variable}}'} placeholders)</Label>
                    <textarea
                      className="w-full text-xs font-mono border border-gray-200 rounded px-3 py-2 h-40 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={editingTmpl.content || ''}
                      onChange={(e) => setEditingTmpl({ ...editingTmpl, content: e.target.value })}
                      placeholder="# Template content..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveTemplate(editingTmpl)} disabled={tmplSaving || !editingTmpl.name || !editingTmpl.content}>
                      {tmplSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTmpl(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {templates.map((tmpl) => (
                  <div key={tmpl.id} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 shrink-0">{tmpl.template_type}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{tmpl.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tmpl.content.slice(0, 80)}…</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => setEditingTmpl({ ...tmpl })}>
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Integrations ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect PI Lawyer OS to your existing software stack.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {INTEGRATION_CATEGORIES.map((category) => {
            const defs = INTEGRATION_DEFS.filter((d) => d.category === category);
            return (
              <div key={category}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{category}</p>
                <div className="space-y-2">
                  {defs.map((def) => {
                    const state = integrationStates[def.slug];
                    const isExpanded = state.expanded;
                    const statusColor =
                      state.status === 'connected' ? 'bg-green-100 text-green-700' :
                      state.status === 'saved'     ? 'bg-blue-100 text-blue-700' :
                      state.status === 'error'     ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500';
                    const statusLabel =
                      state.status === 'connected' ? 'Connected' :
                      state.status === 'saved'     ? 'Saved' :
                      state.status === 'error'     ? `Error` :
                      'Not configured';

                    return (
                      <div key={def.slug} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Collapsed row */}
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          onClick={() => patchIntegration(def.slug, { expanded: !isExpanded })}
                        >
                          <div className="flex items-center gap-2">
                            {def.iconUrl && (
                              <img
                                src={def.iconUrl}
                                alt={def.name}
                                className="w-5 h-5 rounded object-contain flex-shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <span className="font-medium text-sm text-gray-800">{def.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${statusColor}`}>
                              {statusLabel}
                            </span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                          </div>
                        </button>

                        {/* Expanded panel */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                            <p className="text-xs text-gray-600">{def.description}</p>

                            {/* Fields grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {def.fields.map((field) => (
                                <div key={field.key} className="space-y-1">
                                  <Label htmlFor={`${def.slug}-${field.key}`} className="text-xs text-gray-600">
                                    {field.label}
                                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                                  </Label>
                                  <div className="relative">
                                    <Input
                                      id={`${def.slug}-${field.key}`}
                                      className="h-8 text-sm pr-8"
                                      type={field.type === 'password' && !state.showPass[field.key] ? 'password' : 'text'}
                                      placeholder={field.placeholder}
                                      value={state.values[field.key] ?? ''}
                                      onChange={(e) =>
                                        patchIntegration(def.slug, {
                                          values: { ...state.values, [field.key]: e.target.value },
                                          status: 'idle',
                                          statusMsg: '',
                                        })
                                      }
                                    />
                                    {field.type === 'password' && (
                                      <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        onClick={() =>
                                          patchIntegration(def.slug, {
                                            showPass: { ...state.showPass, [field.key]: !state.showPass[field.key] },
                                          })
                                        }
                                      >
                                        {state.showPass[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* How-to toggle */}
                            <div>
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                onClick={() => patchIntegration(def.slug, { showHowTo: !state.showHowTo })}
                              >
                                {state.showHowTo ? '▲' : '▼'} How to get these credentials
                              </button>
                              {state.showHowTo && (
                                <div className="mt-2 p-3 bg-white border border-blue-100 rounded-lg text-xs text-gray-600 space-y-1.5">
                                  <p>{def.howTo}</p>
                                  <a
                                    href={def.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                                  >
                                    Official Docs <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Action row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => saveIntegration(def.slug)}
                                disabled={state.saving}
                              >
                                {state.saving ? 'Saving…' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testIntegration(def.slug)}
                                disabled={state.testing || state.saving}
                              >
                                {state.testing ? 'Testing…' : 'Test Connection'}
                              </Button>
                              {state.statusMsg && (
                                <span className={`text-xs ${state.status === 'error' ? 'text-red-600' : state.status === 'connected' ? 'text-green-600' : 'text-blue-600'}`}>
                                  {state.statusMsg}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
