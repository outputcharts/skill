<p align="left"><img src="assets/mark-brass.svg" width="48" alt=""></p>

# Output Charts skill for AI agents

[![mcptry](https://mcptry.com/badge/com.outputcharts/mcp)](https://mcptry.com/servers/com.outputcharts/mcp)

[Output Charts](https://outputcharts.com) turns JSON into a dashboard with a stable public link. This repository holds the skill file that teaches an agent the whole flow: open an account for the person it works for, build a published dashboard in one HTTP call, hand back the link, and keep the page fresh with pushes from a script, a cron job or its own next run.

`SKILL.md` is a copy of the file the site serves at [outputcharts.com/skill/SKILL.md](https://outputcharts.com/skill/SKILL.md). The site's copy is the one that moves first; `./check-skill.sh` says whether this one still matches it.

## What the skill does

Given a person who wants "a dashboard of these numbers", an agent that has read `SKILL.md` can:

1. **Sign the person up** with `POST /v1/signup` (no key needed): one call with their email address answers a Manage key, an MCP URL and a claim link. The account starts on a seven-day Solo trial, no card.
2. **Build a live dashboard in one call**: `POST /v1/dashboards` with the visuals and `publish: true` answers the public URL. Re-running the same body never makes duplicates.
3. **Keep it fresh**: replace one visual, append rows to a chart or a table (JSON or CSV), or update several visuals at once by ref.
4. **Make a narrower key for CI or a cron**, so the Manage key never lands in a repository secret.
5. **Handle the end of the trial**: a failed call answers `requires_solo` with a `fix`; the agent asks for a Stripe Checkout link and hands it to the person.

Four worked examples are valid as written: a pull request queue, AI coding spend, a client's page speed report and a coding team's flow metrics.

## Install it

### Claude Code

Claude Code loads skills from `.claude/skills/<name>/SKILL.md`, in a project or in your home folder. Either way, one command:

```bash
mkdir -p ~/.claude/skills/outputcharts && curl -fsSL https://outputcharts.com/skill/SKILL.md -o ~/.claude/skills/outputcharts/SKILL.md
```

or, for one project, the same into `.claude/skills/outputcharts/SKILL.md` inside the repository. From then on, "make me a dashboard of …" uses it, and `/outputcharts` invokes it by name.

### Any other agent

The file is plain Markdown with a two-line front matter, so it works wherever an agent reads instructions:

- Put it in the repository the agent works in (for example `docs/outputcharts-skill.md`) and point to it from `AGENTS.md`, `.cursor/rules` or the agent's system prompt.
- Or paste its contents into the agent's instructions.
- Or give the agent the URL `https://outputcharts.com/skill/SKILL.md`; agents that read [llms.txt](https://outputcharts.com/llms.txt) find it there too.

## The MCP server

The same API is an MCP server at `https://api.outputcharts.com/mcp` (streamable HTTP). It works before an account exists: with no key it serves two tools, `signup` and `describe_visual_types`. After `signup`, reconnect with the key as a bearer token, or add the per-key URL the sign-up returns (`https://api.outputcharts.com/mcp/<key>`) as a connector in a chat app that cannot send a header.

Claude Code:

```bash
claude mcp add --transport http output-charts https://api.outputcharts.com/mcp --header "Authorization: Bearer $OC_KEY"
```

Cursor, Claude, ChatGPT and Grok steps are in [the MCP server docs](https://outputcharts.com/docs/mcp). The full server description for directories is in [mcp-server.md](mcp-server.md), and [server.json](server.json) is the entry for the official MCP Registry.

## Links for agents and people

- [llms.txt](https://outputcharts.com/llms.txt): the one file an agent needs to find everything.
- [Agent API docs](https://outputcharts.com/docs/agent-api): every call, every error with its fix.
- [OpenAPI 3.1](https://api.outputcharts.com/v1/openapi.json) and [the visual types](https://api.outputcharts.com/v1/schema): no key needed.
- [Pricing](https://outputcharts.com/pricing): Free is one dashboard by paste; Solo is $10 a month or $96 a year for 20 dashboards, API keys, push and Format with AI. Every new account starts with seven days of Solo, no card.

## Keep this copy current

```bash
./check-skill.sh
```

fetches the site's file and diffs it against `SKILL.md`; exit code 0 means they match. Pass a path to compare with a local copy instead.

## License

MIT, see [LICENSE](LICENSE). The Output Charts name and mark belong to Output Charts.
