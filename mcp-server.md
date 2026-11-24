# Output Charts MCP server

The text below is what the MCP directories index. Keep every listing consistent with it and with the pricing page.

| Field | Value |
|---|---|
| Name | Output Charts |
| Server id (registry) | `com.outputcharts/mcp` (the domain namespace, verified by a DNS TXT record or an HTTP file; `io.github.outputcharts/mcp` with a GitHub login as `outputcharts` is the fallback if the registry accepts a remote URL under it) |
| One-liner (under 80 characters) | Give your agent a dashboard: a live, shareable page it builds and keeps updating. |
| Short description (under 100 characters) | Dashboards from JSON with a stable public link; sign up, build and keep fresh, all as tools. |
| Remote URL | `https://api.outputcharts.com/mcp` |
| Transport | Streamable HTTP (JSON responses; `POST` only, `GET` answers 405) |
| Authentication | None to start. `signup` returns an API key; then send it as `Authorization: Bearer <key>`, or connect at the per-key URL `https://api.outputcharts.com/mcp/<key>` from a chat app that cannot send a header. |
| Tools listed | All 22, with or without a key (a Push only key lists the seven it can call) |
| Tools that run with no key | `signup`, `describe_visual_types` |
| Tools that need a key | `whoami`, `create_api_key`, `get_checkout_link`, `list_dashboards`, `create_dashboard`, `get_dashboard`, `update_dashboard`, `reorder_visuals`, `publish_dashboard`, `unpublish_dashboard`, `share_dashboard`, `list_shares`, `revoke_share`, `create_visual`, `batch_update`, `get_visual`, `update_visual`, `delete_visual`, `push_visual_data`, `append_rows`, plus the two above (22 in all) |
| Website | https://outputcharts.com |
| Docs | https://outputcharts.com/docs/mcp (setup per client) · https://outputcharts.com/docs/agent-api (every call) |
| Skill file | https://outputcharts.com/skill/SKILL.md |
| llms.txt | https://outputcharts.com/llms.txt |
| OpenAPI | https://api.outputcharts.com/v1/openapi.json |
| Source / listing repo | https://github.com/outputcharts/skill |
| Pricing | Free: one dashboard by paste. Solo: $10 a month or $96 a year. Every new account starts with a seven-day Solo trial, no card. |
| Categories | Data visualization · Dashboards · Analytics and reporting · Developer tools |
| Tags | dashboard, charts, kpi, data-visualization, reporting, analytics, api, agent, remote |
| Icon | `assets/mark-brass.svg` (mark), `assets/mark-tile-graphite-1024.png` (square tile for listings that need a PNG) |

## Long description

Output Charts turns JSON into a dashboard with a stable public link. Connected as an MCP server, an agent can open an account for the person it works for (`signup`, no key needed), build a published dashboard in one call (`create_dashboard` with the visuals and `publish: true` answers the page's URL), and keep it fresh: replace a visual (`push_visual_data`), append rows to a chart or a table (`append_rows`), or update several visuals at once by ref (`batch_update`). The visual types are bar, horizontal bar, line, area, pie, KPI, table, markdown, scatter, funnel, gauge and map (world, US states or US counties), each one JSON document the server validates with a `fix` and an `example` on every refusal. Re-running a create with the same refs never makes duplicates. The account starts on a seven-day Solo trial with no card; when it ends, calls answer `requires_solo` with a fix, and `get_checkout_link` hands the agent a Stripe Checkout link for the person.

## How a person connects

- **No account yet:** add `https://api.outputcharts.com/mcp` with no authentication. The server offers `signup` and `describe_visual_types`. Ask the agent to sign you up; it gets a key and the per-key URL, and hands you a claim link.
- **With a key:** clients that send headers connect to `https://api.outputcharts.com/mcp` with `Authorization: Bearer <key>`; chat apps that cannot send a header connect to `https://api.outputcharts.com/mcp/<key>` instead. That URL is as secret as the key; revoking the key cuts it off.

Claude Code:

```bash
claude mcp add --transport http output-charts https://api.outputcharts.com/mcp --header "Authorization: Bearer $OC_KEY"
```

Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "output-charts": {
      "url": "https://api.outputcharts.com/mcp",
      "headers": { "Authorization": "Bearer ${env:OC_KEY}" }
    }
  }
}
```

Claude (web and desktop apps): Customize → Connectors → Add custom connector, name it Output Charts, paste the URL, choose No sign in.

## Instructions the server sends

With no key: "You are connected without an API key. Every tool is listed, but only signup and describe_visual_types run without a key; the others answer invalid_api_key until you reconnect with one. Call signup with the person's email address to create their Output Charts account and get a key, then reconnect: scripts and IDE agents send Authorization: Bearer <key>; chat apps add a new connector at the mcpUrl in the result."

With a key: "Output Charts builds dashboards of visuals. Call describe_visual_types once to learn the visual types, their document rules and an example of each. Dashboards and visuals have a ref you choose: create them with a ref so a later run finds the same object instead of making a duplicate, and push new data to a visual by its id with push_visual_data. Make calls to one dashboard one at a time. No tool deletes a dashboard. When a call answers requires_solo, the account's Solo trial has ended: call get_checkout_link and give the person the checkoutUrl; whoami still works, and every call works again as soon as they pay."

## Limits

60 tool calls a minute per key (listing the tools does not count). Sign-ups: 5 per IP and 300 in all per UTC day. 20 dashboards per account on Solo, 24 visuals per dashboard, documents up to 100 KB, 500 rows per chart and 200 per table.
