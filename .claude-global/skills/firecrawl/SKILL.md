# Skill: Firecrawl

Web scraping and web-to-LLM data pipeline tool.
Repo: https://github.com/mendableai/firecrawl

---

## What It Does

Firecrawl turns any URL into clean, structured LLM-ready markdown. Handles JS rendering,
anti-bot detection, pagination, and full-site crawls. Used for:
- Competitive research and market analysis
- Client website audits
- Documentation scraping for RAG pipelines
- AI OS data ingestion

---

## When to Apply

- TRIGGER: User asks to scrape, crawl, or extract data from a website
- TRIGGER: User references a URL and wants its content processed
- TRIGGER: Building a RAG pipeline that needs web content
- TRIGGER: "scrape", "crawl", "extract from site", "get content from"

Do NOT use WebFetch for sites requiring JS rendering or multi-page crawls — use Firecrawl.

---

## MCP Setup

Plugin: `firecrawl@claude-plugins-official` (enabled in settings.json)

Or manual MCP config:
```json
{
  "firecrawl": {
    "command": "npx",
    "args": ["-y", "firecrawl-mcp"],
    "env": {
      "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
    }
  }
}
```

API key obtained from: https://firecrawl.dev/dashboard

---

## Core Operations

### Scrape a single URL
```
firecrawl_scrape(url="https://example.com", formats=["markdown"])
```

### Crawl a full site
```
firecrawl_crawl(url="https://docs.example.com", limit=50, scrapeOptions={formats:["markdown"]})
```

### Search web (returns clean markdown)
```
firecrawl_search(query="topic", limit=5)
```

### Extract structured data
```
firecrawl_extract(urls=["https://example.com"], prompt="Extract pricing table", schema={...})
```

---

## Onnex Usage Patterns

- Client website audits → scrape → save to `outputs/research/<client>/`
- RAG ingestion → crawl docs → pipe to RAG-Anything
- Competitive analysis → scrape competitor sites → synthesize with autoresearch

---

## Status
NEEDS CONFIGURATION — FIRECRAWL_API_KEY required. See configuration prompt.
