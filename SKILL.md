---
name: outputcharts
description: Build and keep updated a shareable Output Charts dashboard from any data; sign up for the person if they have no account
---

# Output Charts for agents

Output Charts turns JSON into a dashboard with a stable public link. You build the dashboard with one HTTP call, hand the person the link, and keep it fresh with pushes from a script, a cron job or your own next run. The page redraws within 15 seconds of a push; the link never changes.

Base URL: `https://api.outputcharts.com`. Every call sends and returns JSON (`Content-Type: application/json`), and every call but sign-up and the two public reads carries `Authorization: Bearer <key>`. The OpenAPI document is `GET /v1/openapi.json`; the visual types with their document rules, an example of each and their size limits are `GET /v1/schema`. Neither needs a key.

## When to use this

- The person asked you for a dashboard, a chart, a report, a status page or "a link I can send": numbers they want to look at more than once.
- The numbers already exist in something you can run: a log, a CSV, an API, a CI job, a spreadsheet export.
- They want the thing to stay current without you rebuilding it every time.

Do not use it for a one-off answer in chat. There are two ways to give people access, and step 2 takes either or both: publish, which opens the page to anyone with the link (not indexed by search engines unless the owner lists it), or share by email, which gives named people view access after they sign in. Pick the one that matches what the person asked for; data that only certain people should see is shared, not published.

## The flow

### 1. No key yet: sign the person up

One call, no key, with the person's email address:

```bash
curl -X POST https://api.outputcharts.com/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"person@example.com","agentName":"Claude Code","useCase":"PR queue dashboard"}'
```

It answers `201` with:

- `apiKey.secret`: a Manage key, shown once. Keep it for the rest of the session and send it as the bearer token on every call. Never print it in a public place.
- `apiKey.mcpUrl`: the same key as an MCP connector URL, for chat apps that cannot send a header.
- `claimUrl`: give this to the person in your reply. It opens the page where they sign in (Google, or a password they set) and take the account over. They also get an email with the same link (`claimEmailSent` is false when none could be sent: then the link in your reply is the only one). They must open it within 24 hours of sign-up: from then on every push answers `403 claim_required`, with `claimUrl` and a `fix`, until they do, and resumes the moment they do.
- `account`: `tier: "free"`. Every account is free for one dashboard, which the key builds and keeps current; there is no trial. `next` repeats the plan's rule in one sentence: you can build now and correct freely for the dashboard's first 24 hours, and after that each visual takes one update a day. The rest is section 5.
- `unclaimedUntil`: an account nobody claims and nobody pays for is deleted 30 days after sign-up, dashboards included. Say so to the person.

Refusals: `409 email_taken` when the address already has an account (its `fix` says to hand the owner the whole dashboard as one JSON block that names each visual by its ref, to import signed in: into the dashboard they have, by opening it and choosing Import JSON, or Workspace → Import JSON when they have none yet; or to make a key under Account → API keys; do not try another spelling of their address); `429 rate_limited` after 5 sign-ups from one IP or 300 in all per UTC day; `400 invalid_request` for a malformed address or an `agentName` with characters other than letters, digits, spaces and `. , ' & ( ) + _ -`.

If the person already has a key, skip this step. If they have an account but no key, they can make one under Account → API keys (Free accounts can); or skip the API: give them the whole dashboard as one JSON block in your reply, the body of step 2 with a `ref` on every visual, and tell them to sign in and import it: into the dashboard they already have by opening it and choosing Import JSON (a visual whose ref it has is updated in place, the others are added), or from Workspace → Import JSON when they have none. `GET /v1/me` tells you what a key is and what the account may do.

### 2. Build the dashboard in one call

`POST /v1/dashboards` with the visuals and `publish: true` makes the dashboard, every visual in order, and the public page, and answers `201` with `dashboard.url`. Hand that URL to the person.

Two ways to give people access, in the same call or later, with or without each other:

- `"publish": true`: the page at `dashboard.url` opens for anyone with the link. Later: `POST /v1/dashboards/{id}/publish` and `.../unpublish`.
- `"shareWith": ["colleague@example.com", …]`: each person gets an email with the link to the shared page and view-only access once they sign in with that address (an account is made for them at sign-in if they have none); the dashboard can stay private. The answer's `shares` lists one result per address with the page's `url`, and the same address on a re-run answers `created: false` with no second email. Later: `POST /v1/dashboards/{id}/shares` with `{ "email" }`, `GET .../shares` to see them, `DELETE .../shares/{shareId}` to revoke; at most 20 per dashboard.

- Give the dashboard and every visual a `ref` (1 to 64 of `a-z`, `0-9`, `-`, unique per owner for dashboards and per dashboard for visuals). A later run with the same body answers `200` with `created: false` and the same objects, so re-running never makes duplicates, and a run cut short by an error is finished by the next.
- Each visual is `{ "type", "title", "ref", "document", "size" }`. `document` is the visual's whole JSON (settings and data together), valid for its `type`; the rules per type are in `GET /v1/schema`, and the worked examples below are valid as written. `size` is `{ "w", "h" }`: `w` in columns of a 12-column grid, `h` in 50-pixel rows, each type with its own minimums: a KPI or markdown is at least 3 by 3, a table at least 4 by 4, every chart and the gauge at least 3 wide and 4 tall, a map at least 4 wide and 6 tall; the maximum is 12 by 16 for all. A size outside that is `400` with a `fix` naming the type's limits. Leave `size` out for the type's default (6 by 3 for a KPI, 6 by 8 for a chart or a table, 12 by 14 for a map: full width).
- Everything is checked before anything is written. A bad document answers `422 invalid_document` with `details` (each a `path` such as `visuals[2].document.data[0].users` and a `message`), a `fix` sentence and an `example` document of that type (for a heatmap, of the layout sent); nothing exists afterwards. `"dryRun": true` answers `200 { "dryRun": true }` or that error, writing nothing.
- Limits: 20 dashboards per account on Solo, 24 visuals per dashboard, documents up to 100 KB, 500 rows per chart and 200 per table, 60 calls a minute per key. A Free account has one dashboard (see section 5).

### 3. Keep it fresh

Three ways, all with a Push or Manage key, all answering `coerced` (the numeric strings that became numbers, at most 20 listed) and `coercedCount`:

- Replace one visual: `PUT /v1/visuals/{id}/data` with the new document as the body.
- Append rows to a chart or a table: `POST /v1/visuals/{id}/rows` with `{ "rows": [ … ], "keepLast": 90 }`. The visual's settings stay; the rows go on the end and the oldest fall off past `keepLast`. On a map the rows merge by region, on a progress list or a status grid by name, and on a heatmap by cell (the x and y pair) or by date, instead (a sent row replaces the stored row with the same code, name, cell or date, the others are added, `keepLast` is ignored), so three states update without re-sending fifty. An append that would take one of these past its row cap (20 on a progress list, 200 on a status grid, 1000 on a heatmap, 4000 on a map) is refused at `rows`, with a `fix`: replace the whole list with `PUT /v1/visuals/{id}/data`. A calendar heatmap keeps its latest 366 days on its own, so a daily job can push forever: the latest date sets a calendar's 366-day window, an append drops the days before it and counts them in `dropped`, and an append that would push every stored day out of it is refused, so a mistyped year cannot erase the calendar. Two appends at the same moment lose nothing.
- Update several visuals at once: `PUT /v1/dashboards/{id}/data` with `{ "<ref>": <document>, … }`. Every entry is tried; `200` when all were written, `422 batch_failed` with per-ref `results` otherwise.

Both the replace and the append also take `Content-Type: text/csv`: the header row is the keys the visual's rows have (`date,users`), and on the append `keepLast` goes in the query string (`?keepLast=90`). A header with a key the visual does not have is `422` with a `fix` naming the keys it expects; no column is dropped in silence.

Numbers in strings are read for you at the fields that must be numbers: `"1,234.5"`, `"$12"`, `"(3)"`, `"1 000"` become numbers; `"25%"` becomes `0.25` in a field the page shows as a percent and `25` elsewhere; in a table's number cells `N/A`, `-` and blank become `null`. Dates and labels are never rewritten: they display as sent, so send them sorted and in one format.

Visual ids come back in the create's `visuals[]` (one per entry, in order) and from `GET /v1/dashboards/{id}`. Make calls to one dashboard one at a time. No call deletes a dashboard.

### 4. A key for CI or a cron

`POST /v1/keys` with a Manage key makes a narrower one: `{ "name": "CI", "scope": "push", "dashboardId": "<the dashboard>" }` answers `201` with a key that can only send data to that dashboard's visuals, shown once. That is the key to put in a repository secret or a crontab; keep the Manage key out of them. Five live keys per account.

### 5. On Free

A Free account has one dashboard. Its keys build it and keep it current: for the dashboard's first 24 hours nothing is limited, and after that each visual takes one update a day and the account three new visuals a day. Past that the call answers 429 daily_limit with nextUpdateAt; until then, hand the person one JSON block that names each visual by its ref, to import into that dashboard (they open it and choose Import JSON, which updates the visuals whose refs it has and adds the others), or get them a Checkout link with POST /v1/billing/checkout. The workspace's own Import JSON makes a new dashboard, which a Free account that has its one cannot. A key of a Free account that holds more than one dashboard changes only the first; another answers 403 requires_solo with writableDashboardId.

`GET /v1/me` says which of these applies before you push: `owner.tier`, `owner.dashboardCount` and `owner.dashboardLimit`, and `limits`, with `updatesPerVisualPerDay` (1) and `newVisualsPerDay` (3) on Free (`null` on Solo), `writableDashboardId` (the first dashboard) and `firstDayEndsAt` (`null` once the first day is over).

The daily refusal, with a `Retry-After` header in seconds:

```json
{
  "error": "This chart was already updated today on the Free plan",
  "code": "daily_limit",
  "nextUpdateAt": "2026-11-28T00:00:00.000Z",
  "upgradeUrl": "https://outputcharts.com/account/billing",
  "fix": "Wait until nextUpdateAt; or give the person one JSON block that names each visual by its ref, to import into this dashboard (they open the dashboard and choose Import JSON, which updates the visuals whose refs it has); or get them a checkout link with POST /v1/billing/checkout."
}
```

A new chart past the three a day answers the same code with `This account has added 3 charts today on the Free plan`. A key that tries a second dashboard on Free answers:

```json
{
  "error": "On Free an API key can change one dashboard",
  "code": "requires_solo",
  "upgradeUrl": "https://outputcharts.com/account/billing",
  "writableDashboardId": "…",
  "fix": "This account is on Free, where a key changes only its first dashboard, …. Work on that one, or get the owner a checkout link with POST /v1/billing/checkout."
}
```

Nothing is deleted: the dashboards stay readable and the public pages stay up. A signed-in person's edits and Import JSON are never limited. An account that already pays answers `409 already_subscribed` to the checkout call (nothing to pay; every call works). To lift the limits, `POST /v1/billing/checkout` (Manage key; `{ "interval": "monthly" | "yearly", "promotionCode"?: "…" }`, the code applied when given one) answers `{ "checkoutUrl", "sessionId" }`. Give `checkoutUrl` to the person; it is a hosted Stripe page. The moment they pay, the account is on Solo and updates are live.

A different 403, `claim_required`, has two meanings. When the person has not claimed the account within 24 hours of sign-up, every key call answers it, with `claimUrl`, `upgradeUrl` and a `fix`; nothing is deleted, `GET /v1/me` and the checkout still answer, and every call works again the moment the person opens the claim link. Give them `claimUrl` again and wait; do not sign them up anew. And from sign-up on, until the person has claimed the account, a call that would send a share email (`POST /v1/dashboards/{id}/shares`, or `shareWith`) answers it with `claimUrl` and a `fix`: an account you opened can send share emails only after the person has claimed it. Build and publish first, give the person the link and the claim link, and share once they have signed in.

### 6. Over MCP instead of HTTP

The same API is an MCP server. With no key, `https://api.outputcharts.com/mcp` lists every tool and runs two, `signup` and `describe_visual_types`; after `signup`, reconnect with the key as a bearer token at the same URL (Claude Code: `claude mcp add --transport http output-charts https://api.outputcharts.com/mcp --header "Authorization: Bearer $OC_KEY"`) or add `apiKey.mcpUrl` as a connector in a chat app. The tools are the calls above by name: `create_dashboard`, `push_visual_data`, `append_rows`, `batch_update`, `create_api_key`, `get_checkout_link`, `whoami`.

## Worked examples

Each body below is a complete `POST /v1/dashboards` call: send it as is (with the person's titles and numbers), get `dashboard.url` back, then keep it fresh as shown. The refs are what the batch bodies key on.

### Pull request queue, refreshed by GitHub Actions every hour

Which PRs are waiting and for how long. A workflow lists open PRs with `gh pr list --json number,title,author,createdAt` and pushes.

```json
{
  "title": "Pull request queue",
  "ref": "pr-queue",
  "publish": true,
  "visuals": [
    {
      "type": "kpi",
      "title": "Oldest open PR",
      "ref": "oldest-pr",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Oldest open PR", "value": 9, "format": "number", "suffix": " days" }
    },
    {
      "type": "kpi",
      "title": "Open PRs",
      "ref": "open-count",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Open PRs", "value": 3, "format": "number", "delta": -2, "deltaFormat": "number", "deltaLabel": "vs yesterday" }
    },
    {
      "type": "table",
      "title": "Waiting for review",
      "ref": "open-prs",
      "size": { "w": 12, "h": 8 },
      "document": {
        "columns": [
          { "key": "pr", "label": "PR", "align": "left", "format": "text" },
          { "key": "title", "label": "Title", "align": "left", "format": "text" },
          { "key": "author", "label": "Author", "align": "left", "format": "text" },
          { "key": "days", "label": "Open (days)", "align": "right", "format": "number" }
        ],
        "data": [
          { "pr": "#212", "title": "Retry failed webhook deliveries", "author": "sam", "days": 9 },
          { "pr": "#219", "title": "Move billing emails to the queue", "author": "ana", "days": 4 },
          { "pr": "#223", "title": "Fix timezone in weekly report", "author": "sam", "days": 1 }
        ]
      }
    }
  ]
}
```

The queue is the current state, so every hour the workflow replaces all three in one batch, `PUT /v1/dashboards/{id}/data`, with a Push key bound to the dashboard (step 4) in the repository's secrets:

```json
{
  "oldest-pr": { "label": "Oldest open PR", "value": 10, "format": "number", "suffix": " days" },
  "open-count": { "label": "Open PRs", "value": 4, "format": "number", "delta": 1, "deltaFormat": "number", "deltaLabel": "vs yesterday" },
  "open-prs": {
    "columns": [
      { "key": "pr", "label": "PR", "align": "left", "format": "text" },
      { "key": "title", "label": "Title", "align": "left", "format": "text" },
      { "key": "author", "label": "Author", "align": "left", "format": "text" },
      { "key": "days", "label": "Open (days)", "align": "right", "format": "number" }
    ],
    "data": [
      { "pr": "#212", "title": "Retry failed webhook deliveries", "author": "sam", "days": 10 },
      { "pr": "#219", "title": "Move billing emails to the queue", "author": "ana", "days": 5 },
      { "pr": "#223", "title": "Fix timezone in weekly report", "author": "sam", "days": 2 },
      { "pr": "#231", "title": "Add a retry budget to the worker", "author": "kim", "days": 0 }
    ]
  }
}
```

### AI coding spend and cache share, from a usage export

Which model is eating the budget, and how much input is served from the prompt cache. The source is a usage CSV (`date,model,input_tokens,cached_tokens,output_tokens,cost_usd`) summed per day and per model.

```json
{
  "title": "AI coding spend",
  "ref": "ai-spend",
  "publish": true,
  "visuals": [
    {
      "type": "kpi",
      "title": "Input served from cache",
      "ref": "cache-share",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Input served from cache", "value": 0.976, "format": "percent" }
    },
    {
      "type": "kpi",
      "title": "Spend this month",
      "ref": "month-spend",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Spend this month", "value": 41.3, "format": "number", "prefix": "$" }
    },
    {
      "type": "line",
      "title": "Daily cost by model",
      "ref": "daily-cost",
      "size": { "w": 12, "h": 7 },
      "document": {
        "xKey": "date",
        "curve": "monotone",
        "series": [{ "key": "model-a", "label": "model-a" }, { "key": "model-b", "label": "model-b" }],
        "data": [
          { "date": "2026-10-12", "model-a": 3.1, "model-b": 0.4 },
          { "date": "2026-10-13", "model-a": 3.9, "model-b": 0.6 },
          { "date": "2026-10-14", "model-a": 2.7, "model-b": 0.9 }
        ]
      }
    },
    {
      "type": "bar-horizontal",
      "title": "Cost by model, 30 days",
      "ref": "cost-by-model",
      "size": { "w": 6, "h": 6 },
      "document": {
        "orientation": "horizontal",
        "mode": "grouped",
        "xKey": "model",
        "series": [{ "key": "cost", "label": "Cost (USD)" }],
        "data": [{ "model": "model-a", "cost": 31.4 }, { "model": "model-b", "cost": 9.9 }]
      }
    }
  ]
}
```

Each day the script appends one row to the line, keeping the last 60 days, with `POST /v1/visuals/{daily-cost id}/rows`:

```json
{ "rows": [{ "date": "2026-10-15", "model-a": "3.40", "model-b": "0.70" }], "keepLast": 60 }
```

and replaces the two KPIs and the bar with a batch, `PUT /v1/dashboards/{id}/data`:

```json
{
  "cache-share": { "label": "Input served from cache", "value": "97.9%", "format": "percent" },
  "month-spend": { "label": "Spend this month", "value": "$45.60", "format": "number", "prefix": "$" },
  "cost-by-model": {
    "orientation": "horizontal",
    "mode": "grouped",
    "xKey": "model",
    "series": [{ "key": "cost", "label": "Cost (USD)" }],
    "data": [{ "model": "model-a", "cost": 34.8 }, { "model": "model-b", "cost": 10.6 }]
  }
}
```

(`"97.9%"` is stored as `0.979` because the KPI's format is percent; `"$45.60"` becomes `45.6`. Both are listed in `coerced`.)

### Page speed report for a client

The numbers a client wants from a performance engagement, as one link that stays current after every Lighthouse run. On Solo the public page shows the dashboard alone, with no Output Charts bar.

```json
{
  "title": "Store speed report",
  "ref": "client-speed-report",
  "publish": true,
  "scheme": "paper",
  "visuals": [
    {
      "type": "kpi",
      "title": "Home p75 LCP",
      "ref": "home-lcp",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Home p75 LCP", "value": 3.4, "format": "number", "suffix": " s", "delta": -0.8, "deltaFormat": "number", "deltaLabel": "vs before the fixes" }
    },
    {
      "type": "kpi",
      "title": "Home weight",
      "ref": "home-weight",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Home page weight", "value": 1960, "format": "compact", "suffix": " KB" }
    },
    {
      "type": "bar-horizontal",
      "title": "Page weight before and after",
      "ref": "page-weight",
      "size": { "w": 6, "h": 6 },
      "document": {
        "orientation": "horizontal",
        "mode": "grouped",
        "xKey": "template",
        "series": [{ "key": "before", "label": "Before (KB)" }, { "key": "after", "label": "After (KB)" }],
        "data": [
          { "template": "Collection", "before": 3120, "after": 1840 },
          { "template": "Product", "before": 2480, "after": 1610 },
          { "template": "Home", "before": 1960, "after": 1390 }
        ]
      }
    },
    {
      "type": "table",
      "title": "Slowest routes",
      "ref": "slow-routes",
      "size": { "w": 6, "h": 6 },
      "document": {
        "columns": [
          { "key": "route", "label": "Route", "align": "left", "format": "text" },
          { "key": "lcp", "label": "p75 LCP (s)", "align": "right", "format": "number" },
          { "key": "weight", "label": "Weight (KB)", "align": "right", "format": "number" },
          { "key": "fix", "label": "Planned fix", "align": "left", "format": "text" }
        ],
        "data": [
          { "route": "/collections/all", "lcp": 4.9, "weight": 3120, "fix": "Lazy-load below-fold product images" },
          { "route": "/products/*", "lcp": 4.1, "weight": 2480, "fix": "Preload hero image, drop unused app script" },
          { "route": "/", "lcp": 3.4, "weight": 1960, "fix": "Serve hero as WebP" }
        ]
      }
    }
  ]
}
```

After each run, replace the KPI alone with `PUT /v1/visuals/{home-lcp id}/data`, the body being the document:

```json
{ "label": "Home p75 LCP", "value": 2.9, "format": "number", "suffix": " s", "delta": -1.3, "deltaFormat": "number", "deltaLabel": "vs before the fixes" }
```

or the table from the run's CSV with `Content-Type: text/csv` on the same call (the header must be `route,lcp,weight,fix`; the columns stay as they are).

### Flow metrics for a team's coding agents

Throughput, lead time, work in progress and what is waiting on a person, computed from the agents' logs by a script that runs after each sync.

```json
{
  "title": "Agent flow",
  "ref": "agent-flow",
  "publish": true,
  "visuals": [
    {
      "type": "kpi",
      "title": "Lead time, median",
      "ref": "lead-median",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Lead time, median", "value": 5.2, "format": "number", "suffix": " h", "delta": -1.1, "deltaFormat": "number", "deltaLabel": "vs last week" }
    },
    {
      "type": "kpi",
      "title": "Lead time, p90",
      "ref": "lead-p90",
      "size": { "w": 4, "h": 3 },
      "document": { "label": "Lead time, p90", "value": 19.5, "format": "number", "suffix": " h" }
    },
    {
      "type": "gauge",
      "title": "Stories in flight",
      "ref": "wip",
      "size": { "w": 4, "h": 4 },
      "document": { "label": "Stories in flight", "value": 7, "min": 0, "max": 10 }
    },
    {
      "type": "area",
      "title": "Cumulative flow",
      "ref": "cfd",
      "size": { "w": 8, "h": 7 },
      "document": {
        "xKey": "day",
        "curve": "step",
        "stacked": true,
        "series": [
          { "key": "merged", "label": "Merged" },
          { "key": "review", "label": "In review" },
          { "key": "building", "label": "Building" },
          { "key": "queued", "label": "Queued" }
        ],
        "data": [
          { "day": "Oct 14", "merged": 3, "review": 2, "building": 4, "queued": 6 },
          { "day": "Oct 15", "merged": 6, "review": 3, "building": 4, "queued": 5 },
          { "day": "Oct 16", "merged": 11, "review": 2, "building": 5, "queued": 3 }
        ]
      }
    },
    {
      "type": "table",
      "title": "Waiting on a person",
      "ref": "stuck",
      "size": { "w": 4, "h": 7 },
      "document": {
        "columns": [
          { "key": "story", "label": "Story", "align": "left", "format": "text" },
          { "key": "hours", "label": "Stuck (h)", "align": "right", "format": "number" },
          { "key": "waiting", "label": "Waiting on", "align": "left", "format": "text" }
        ],
        "data": [
          { "story": "Story 41", "hours": 9, "waiting": "Approve schema change" },
          { "story": "Story 38", "hours": 6, "waiting": "Flaky test" }
        ]
      }
    }
  ]
}
```

Daily: append the day's counts to the flow chart (`POST /v1/visuals/{cfd id}/rows`, keeping 30 days) and batch the rest:

```json
{ "rows": [{ "day": "Oct 17", "merged": 14, "review": 3, "building": 4, "queued": 2 }], "keepLast": 30 }
```

```json
{
  "lead-median": { "label": "Lead time, median", "value": 4.8, "format": "number", "suffix": " h", "delta": -0.4, "deltaFormat": "number", "deltaLabel": "vs last week" },
  "lead-p90": { "label": "Lead time, p90", "value": 17.2, "format": "number", "suffix": " h" },
  "wip": { "label": "Stories in flight", "value": 6, "min": 0, "max": 10 },
  "stuck": {
    "columns": [
      { "key": "story", "label": "Story", "align": "left", "format": "text" },
      { "key": "hours", "label": "Stuck (h)", "align": "right", "format": "number" },
      { "key": "waiting", "label": "Waiting on", "align": "left", "format": "text" }
    ],
    "data": [{ "story": "Story 41", "hours": 21, "waiting": "Approve schema change" }]
  }
}
```

### Where the customers are, by country and by state

A map takes one row per region: the world map by ISO 3166-1 alpha-2 code, the US states map by USPS code, the US counties map by five-digit county FIPS code. Regions with no row stay neutral; the legend runs from the lowest value to the highest.

```json
{
  "title": "Where the customers are",
  "ref": "where-the-customers-are",
  "scheme": "carbon",
  "publish": true,
  "visuals": [
    {
      "type": "kpi", "title": "Sign-ups this month", "ref": "signups", "size": { "w": 12, "h": 3 },
      "document": { "label": "Sign-ups in October", "value": 1284, "format": "number", "delta": 0.18, "deltaFormat": "percent", "deltaLabel": "vs September" }
    },
    {
      "type": "map", "title": "By country", "ref": "by-country", "size": { "w": 12, "h": 14 },
      "document": {
        "region": "world", "idKey": "country", "valueKey": "signups", "format": "number",
        "data": [
          { "country": "US", "signups": 512 }, { "country": "GB", "signups": 141 }, { "country": "DE", "signups": 98 },
          { "country": "IN", "signups": 94 }, { "country": "CA", "signups": 77 }, { "country": "AU", "signups": 46 },
          { "country": "BR", "signups": 39 }, { "country": "SG", "signups": 21 }
        ]
      }
    },
    {
      "type": "map", "title": "By US state", "ref": "by-state", "size": { "w": 12, "h": 12 },
      "document": {
        "region": "us-states", "idKey": "state", "valueKey": "signups", "format": "number",
        "data": [
          { "state": "CA", "signups": 131 }, { "state": "NY", "signups": 88 }, { "state": "TX", "signups": 72 },
          { "state": "WA", "signups": 51 }, { "state": "MA", "signups": 38 }, { "state": "FL", "signups": 34 },
          { "state": "IL", "signups": 29 }, { "state": "CO", "signups": 22 }
        ]
      }
    }
  ]
}
```

Next month, both maps in one batch, each the whole row list (a map is a snapshot, so a region that dropped to zero gets a `0` row, not silence); a handful of changed regions can go to `POST /v1/visuals/{id}/rows` instead and merge by code:

```json
{
  "by-country": { "region": "world", "idKey": "country", "valueKey": "signups", "format": "number", "data": [{ "country": "US", "signups": 540 }, { "country": "GB", "signups": 150 }, { "country": "DE", "signups": 101 }] },
  "by-state": { "region": "us-states", "idKey": "state", "valueKey": "signups", "format": "number", "data": [{ "state": "CA", "signups": 140 }, { "state": "NY", "signups": 95 }, { "state": "TX", "signups": 80 }] }
}
```

### Project progress and site checks, one call

Four projects against their own targets and the checks behind them: a progress list takes one row per project (the bar is done over total, the rules colour it) and a status grid one tile per check, your words mapped to good, warn or bad.

```json
{
  "title": "Project progress",
  "ref": "project-progress",
  "scheme": "ledger",
  "publish": true,
  "visuals": [
    {
      "type": "progress",
      "title": "Done against target",
      "ref": "progress",
      "size": {
        "w": 7,
        "h": 9
      },
      "document": {
        "nameKey": "project",
        "valueKey": "done",
        "maxKey": "total",
        "format": "number",
        "suffix": " items",
        "rules": [
          {
            "below": 0.5,
            "status": "bad"
          },
          {
            "below": 0.9,
            "status": "warn"
          },
          {
            "atLeast": 0.9,
            "status": "good"
          }
        ],
        "data": [
          { "project": "Website relaunch", "done": 34, "total": 40 },
          { "project": "Mobile app", "done": 12, "total": 30 },
          { "project": "Docs rewrite", "done": 22, "total": 20 },
          { "project": "Billing migration", "done": 18, "total": 24 }
        ]
      }
    },
    {
      "type": "status-grid",
      "title": "Checks",
      "ref": "checks",
      "size": {
        "w": 5,
        "h": 9
      },
      "document": {
        "nameKey": "name",
        "statusKey": "check",
        "noteKey": "note",
        "statuses": {
          "Passing": "good",
          "Warnings": "warn",
          "Failing": "bad"
        },
        "data": [
          { "name": "Website relaunch · build", "check": "Passing", "note": "Last run 23 Nov" },
          { "name": "Website relaunch · links", "check": "Warnings", "note": "4 redirects open" },
          { "name": "Mobile app · build", "check": "Failing", "note": "Since 20 Nov" },
          { "name": "Mobile app · tests", "check": "Passing", "note": "212 of 212" },
          { "name": "Billing migration · tests", "check": "Warnings", "note": "2 flaky" }
        ]
      }
    }
  ]
}
```

When one project moves, send only its row to `POST /v1/visuals/{id}/rows`: a progress list merges by name, so the row replaces the stored `Mobile app` row and the other projects stay. A status grid merges by name the same way, so one check that went green is one row.

```json
{"rows":[{"project":"Mobile app","done":19,"total":30}]}
```

### Monthly money flow, one call

A month of household money: a sankey takes one row per flow (an amount from one named item to another, read left to right, so no flow may loop back) and a treemap one row per merchant, grouped by category, with the same totals.

```json
{
  "title": "Monthly spending",
  "ref": "monthly-spending",
  "scheme": "paper",
  "publish": true,
  "visuals": [
    {
      "type": "sankey",
      "title": "Where the money went",
      "ref": "flow",
      "size": {
        "w": 12,
        "h": 10
      },
      "document": {
        "sourceKey": "from",
        "targetKey": "to",
        "valueKey": "amount",
        "format": "number",
        "prefix": "$",
        "data": [
          { "from": "Salary", "to": "Budget", "amount": 5200 },
          { "from": "Side job", "to": "Budget", "amount": 800 },
          { "from": "Budget", "to": "Home", "amount": 2105 },
          { "from": "Budget", "to": "Food", "amount": 885 },
          { "from": "Budget", "to": "Savings", "amount": 3010 },
          { "from": "Food", "to": "Grocer", "amount": 420 },
          { "from": "Food", "to": "Cafe", "amount": 220 },
          { "from": "Food", "to": "Other food", "amount": 245 }
        ]
      }
    },
    {
      "type": "treemap",
      "title": "Spending by merchant",
      "ref": "merchants",
      "size": {
        "w": 12,
        "h": 8
      },
      "document": {
        "nameKey": "merchant",
        "valueKey": "spent",
        "groupKey": "category",
        "format": "number",
        "prefix": "$",
        "data": [
          { "category": "Home", "merchant": "Rent", "spent": 1800 },
          { "category": "Home", "merchant": "Utilities", "spent": 305 },
          { "category": "Food", "merchant": "Grocer", "spent": 420 },
          { "category": "Food", "merchant": "Cafe", "spent": 220 },
          { "category": "Food", "merchant": "Other food", "spent": 245 }
        ]
      }
    }
  ]
}
```

Next month, replace both documents; neither has a row list, so there is no append: send each whole document with `PUT /v1/visuals/{id}/data`, or both in one batch by ref, `PUT /v1/dashboards/{id}/data`. A flow that would close a loop (`Savings` back into `Budget`) is refused with the loop named, and a merchant at `0` stays in the data but is not drawn.

```json
{
  "flow": { "sourceKey": "from", "targetKey": "to", "valueKey": "amount", "format": "number", "prefix": "$", "data": [{ "from": "Salary", "to": "Budget", "amount": 5200 }, { "from": "Budget", "to": "Home", "amount": 2105 }, { "from": "Budget", "to": "Savings", "amount": 3095 }] },
  "merchants": { "nameKey": "merchant", "valueKey": "spent", "groupKey": "category", "format": "number", "prefix": "$", "data": [{ "category": "Home", "merchant": "Rent", "spent": 1800 }, { "category": "Home", "merchant": "Utilities", "spent": 305 }] }
}
```

## Rules that save a call

- Every row of a chart needs the x key and every series key; put `0`, not nothing, where a day had no value. A line or area takes 1 to 6 series; a bar takes `orientation` (`vertical` for `bar`, `horizontal` for `bar-horizontal`) and `mode` (`grouped` or `stacked`).
- A `line`, `area`, `bar` or `bar-horizontal` takes `references`, up to 6 of `{ "value": 100, "label": "Budget" }` (a flat line) or `{ "at": "Mar", "label": "Launch" }` (a marker at a category; a `value` reference takes `"axis": "right"` when a series is on the right axis, line and bar only); a `line` or `area` series takes `"dashed": true`. A `line` series takes `"axis": "right"` (one series stays left); a `bar` series takes `"as": "line"`, and such a series may also be dashed and on the right axis. A `table` text column takes `statuses` (`{ "Patched": "good", "Not patched": "bad" }`, values good, warn or bad); a number or percent column takes `rules` (`[{ "below": 0, "status": "bad" }, { "atLeast": 0.2, "status": "good" }]`, first match wins). A text column also takes `hrefKey`, a row key holding an http(s) URL that links the cell.
- A KPI is `{ label, value, format }` plus optional `prefix`, `suffix`, `delta`, `deltaFormat`, `deltaLabel`, `trend` (up to 60 numbers, oldest first); `format` is `number`, `compact` or `percent`, and a percent value is a fraction (`0.25`). A gauge is `{ label, value, min, max }`. A table's `columns` carry `key`, `label`, `align` (`left` or `right`) and `format` (`text`, `number`, `percent`).
- A map is `{ region, idKey, valueKey, data }` plus optional `labelKey`, `format`, `prefix`, `suffix`; `region` is `world` (rows keyed by ISO 3166-1 alpha-2 code, `DE`; alpha-3 accepted), `us-states` (USPS code, `CA`; two-digit FIPS accepted) or `us-counties` (five-digit county FIPS code, `06037`; the county lines of 2017), case ignored, one row per region. A real code with no shape on the map (Puerto Rico and the territories; territories drawn as part of their country; Connecticut's planning regions and Alaska's Chugach and Copper River on the counties map) is refused by name: drop the row.
- A progress list is `{ nameKey, valueKey, maxKey or max, data }` plus optional `format`, `prefix`, `suffix`, `rules` (the table's, judged on value ÷ target); up to 20 rows, names unique; an append merges by name, and one that would make more than 20 rows is refused.
- A status grid is `{ nameKey, statusKey, data }` plus optional `statuses` (your words to good, warn or bad), `noteKey`, `hrefKey`; up to 200 items, names unique; without `statuses` a status is good, warn, bad or empty; an append merges by name, and one that would make more than 200 rows is refused.
- A heatmap is `{ layout, valueKey, data }` plus `xKey` and `yKey` (`layout: "grid"`, x and y as strings (`"07"`, not `7`), at most 60 distinct x and 60 distinct y values) or `dateKey` (`layout: "calendar"`, dates as YYYY-MM-DD spanning at most 366 days), and optional `format`, `prefix`, `suffix`; up to 1000 rows, one per cell or date; an append merges by cell or date, and one that would make more than 1000 rows is refused. The latest date sets a calendar's 366-day window: an append drops the days before it and counts them in `dropped`, and an append that would push every stored day out of it is refused. A calendar: `{"layout":"calendar","dateKey":"date","valueKey":"minutes","suffix":" min","data":[{"date":"2026-11-23","minutes":45},{"date":"2026-11-24","minutes":30}]}`.
- Titles up to 120 characters, labels up to 80, table cells up to 200. `scheme` is `ink` (default), `carbon`, `paper`, `ledger`, `slate` or `signal`.
- Treat `fix` as the next instruction and `example` as the shape to copy. A `429` carries `Retry-After` in seconds: to the next UTC minute for a key's `rate_limited`, to the next UTC day for `daily_limit` and for the sign-up caps. A `409 conflict` means two calls changed one dashboard at once: send the call again, one at a time.
- Tell the person four things when you hand over the link: the URL; that the claim link in their email (or `claimUrl`) makes the account theirs and must be opened within 24 hours, or updates pause until it is; that Free is one dashboard that your AI or your code builds and updates, each chart once a day; Solo ($10 a month or $96 a year) is 20 dashboards, live updates, Format with AI and public pages without the bar; and that the account is deleted after 30 days if nobody claims or pays.
- A waterfall is `{ nameKey, valueKey, data }` plus optional `totalKey` (a row with it `true` is a full column: with a value it sets the running total, with the value left out or `null` it shows the total so far), `invert`, `format`, `prefix`, `suffix`; up to 40 steps, names may repeat; no append: send the whole document with `PUT /v1/visuals/{id}/data`.
- A treemap is `{ nameKey, valueKey, data }` plus optional `groupKey` (one level of groups, at most 12), `format`, `prefix`, `suffix`; up to 200 items, values 0 or more, names unique within their group; no append: send the whole document with `PUT /v1/visuals/{id}/data`.
- A sankey is `{ sourceKey, targetKey, valueKey, data }` plus optional `format`, `prefix`, `suffix`; up to 100 flows between at most 50 items, values above 0; no flow from an item to itself, no repeated pair and no loop (a flow whose target already leads back to its source is refused, the loop named); no append: send the whole document with `PUT /v1/visuals/{id}/data`.
