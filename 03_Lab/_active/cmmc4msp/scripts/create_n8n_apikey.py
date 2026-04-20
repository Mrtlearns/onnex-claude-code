"""Create n8n API key and Postgres credential via REST API."""
import subprocess, json, http.cookiejar, urllib.request, urllib.error, urllib.parse, os

from _secrets import require

N8N_BASE = os.environ.get("N8N_INTERNAL_URL", "http://localhost:5678")
EMAIL = os.environ.get("N8N_ADMIN_EMAIL", "admin@cmmc4msp.on-nex.us")
PASSWORD = require("N8N_ADMIN_PASSWORD", prompt=f"n8n admin password for {EMAIL}: ")
PG_PASSWORD = require("PG_APP_PASSWORD", prompt="Postgres cmmc_app password: ")
WEBHOOK_SECRET = require("FASTAPI_WEBHOOK_SECRET", prompt="FastAPI webhook secret: ")

# Set up cookie jar for session
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

def rest(method, path, body=None, extra_headers=None):
    url = f"{N8N_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with opener.open(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}

# Login
print("Logging in...")
r = rest("POST", "/rest/login", {"emailOrLdapLoginId": EMAIL, "password": PASSWORD})
print(f"Login: {r.get('data', {}).get('email', r)}")

# Create API key
scopes = [
    "workflow:create", "workflow:read", "workflow:update", "workflow:delete",
    "workflow:list", "workflow:activate", "workflow:deactivate",
    "credential:create", "credential:update", "credential:list",
    "execution:read", "execution:list",
]
print("\nCreating API key...")
r = rest("POST", "/rest/api-keys", {"label": "cmmc-deploy-2", "scopes": scopes, "expiresAt": None})
print(json.dumps(r.get("data", r), indent=2))

api_key = r.get("data", {}).get("apiKey", "")
if api_key:
    print(f"\n*** API KEY: {api_key} ***")

    # Test the API key
    def api(method, path, body=None):
        url = f"{N8N_BASE}{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"Content-Type": "application/json",
                                              "X-N8N-API-KEY": api_key})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return {"error": e.code, "body": e.read().decode()}

    wf_list = api("GET", "/api/v1/workflows")
    print(f"Workflows via API key: {len(wf_list.get('data', []))}")

    # Create Postgres credential
    print("\nCreating Postgres credential...")
    cred = api("POST", "/api/v1/credentials", {
        "name": "CMMC4MSP Postgres",
        "type": "postgres",
        "data": {
            "host": "postgres",
            "port": 5432,
            "database": "cmmc_main",
            "user": "cmmc_app",
            "password": PG_PASSWORD,
            "ssl": "disable"
        }
    })
    print(f"Postgres credential ID: {cred.get('id', cred)}")

    # Create n8n HTTP Header Auth for webhook secret
    print("\nCreating webhook secret credential...")
    cred2 = api("POST", "/api/v1/credentials", {
        "name": "CMMC Webhook Secret",
        "type": "httpHeaderAuth",
        "data": {
            "name": "X-Webhook-Secret",
            "value": WEBHOOK_SECRET
        }
    })
    print(f"Webhook credential: {cred2.get('id', cred2)}")
else:
    print("No API key returned!")
