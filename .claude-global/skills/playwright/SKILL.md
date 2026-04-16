# Skill: Playwright

Browser automation, E2E testing, and web interaction via natural language.
Repo: https://github.com/microsoft/playwright

---

## What It Does

Playwright MCP gives Claude full browser control: navigate pages, click elements, fill forms,
take screenshots, run E2E tests, and interact with web apps. No test scripts required —
Claude drives the browser directly via the MCP server.

---

## When to Apply

- TRIGGER: User asks to test a web app, click through a UI, or verify a flow
- TRIGGER: User asks for a screenshot of a web page
- TRIGGER: User says "automate", "browse to", "fill in the form", "check if X works"
- TRIGGER: E2E testing for client portal deployments (NDT portal, PI law portal)
- TRIGGER: Any UI regression check after a deployment

---

## Plugin

Enabled in `settings.json` as `playwright@claude-plugins-official`.

MCP server starts automatically via:
```json
{
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest"]
  }
}
```

Requires Node.js installed globally.

---

## Core Operations

### Navigate and screenshot
```
browser_navigate(url="https://example.com")
browser_screenshot()
```

### Click and interact
```
browser_click(element="Login button", ref="...")
browser_type(element="Email input", text="user@example.com")
```

### Run E2E assertion
```
browser_navigate(url="https://app.example.com/login")
browser_type(element="email", text="test@user.com")
browser_click(element="Submit")
browser_wait_for(text="Dashboard")
browser_screenshot()
```

### Extract page content
```
browser_get_text(element="main content")
```

---

## Onnex Usage Patterns

- Post-deployment smoke tests for NDT portal and PI law client portals
- UI regression checks before client demos
- Form automation for data entry tasks
- Screenshot capture for client reports

---

## Status
READY — plugin enabled. No additional configuration required (uses npx, no API key needed).
