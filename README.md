<div align="center">

# Raimand (رایمند) — Autonomous Persian RTL AI Assistant

**A local-first, full-stack AI Assistant & Autonomous Agent workspace built with Next.js 16, PostgreSQL, MCP, Playwright, and native document authoring.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![GitHub Release](https://img.shields.io/github/v/release/w15800974-debug/raimand-ai-assistant?include_prereleases&label=Release)](https://github.com/w15800974-debug/raimand-ai-assistant/releases)

[English](README.md) | [فارسی (Persian)](README.fa.md)

</div>

---

## Overview

**Raimand (رایمند)** is an open-source, self-hosted AI assistant and autonomous agent platform designed from the ground up with first-class **Persian (RTL)** typography (`Vazirmatn`) and **local-first privacy**. Built on Next.js App Router, React 19, Drizzle ORM, and PostgreSQL, Raimand connects to any **OpenAI-compatible API provider** (OpenAI, OpenRouter, Groq, or local LLMs such as Ollama/LM Studio) while keeping your API keys, conversations, long-term memories, and workspace files on your own machine.

## Key Features

- **Autonomous Agent Mode**: Multi-step tool execution loop (`src/lib/agent.ts`) with streaming responses, stop controls, and interactive approval policies (`allow` / `ask` / `deny`).
- **Sandboxed Workspace File System**: Read, write, search, upload, preview, and organize files strictly within your configured `workspaceRoot` and explicitly attached folders (`src/lib/paths.ts`).
- **Native Document Generation & Parsing**: Create and edit real **PDF** (`pdfkit`, `pdf-lib`, `pdf-parse`), **Word `.docx`** (`docx`, `mammoth`), and **PowerPoint `.pptx`** (`pptxgenjs`) files directly from agent workflows.
- **Browser Automation & Web Research**: Integrated **Playwright** (`playwright-core`) browser control with automatic headless/headed switching and built-in Chromium installer, plus web search integrations (Tavily, Brave, SearXNG).
- **Model Context Protocol (MCP)**: Native MCP client (`@modelcontextprotocol/sdk`) to connect external tool servers and manage tools dynamically from the UI.
- **Generative UI & HTML Previews**: Interactive rendered UI frames (`UIFrame`) powered by local `Chart.js` and sandboxed HTML previews.
- **Long-Term Memory, Projects & Cron Scheduler**: Persistent memories, project-scoped workspaces, and a built-in Node.js background task scheduler (`cron-parser`) supporting recurring cron jobs and one-off tasks.
- **Cross-Platform Releases**: Automated GitHub Actions builds for **Linux (`.deb` & `.tar.gz`)** and **Windows (`.zip`)**.

---

## Download Pre-Built Releases (Linux & Windows)

Pre-built standalone packages are published on the [GitHub Releases](https://github.com/w15800974-debug/raimand-ai-assistant/releases) page:

| Platform | Package Format | Quick Run |
|---|---|---|
| **Linux (Ubuntu / Debian)** | `raimand-ai-assistant_<version>_amd64.deb` | `sudo dpkg -i raimand-ai-assistant_*.deb && raimand` |
| **Linux (Portable)** | `raimand-ai-assistant-v<version>-linux-x64.tar.gz` | Extract and run `./start-raimand.sh` |
| **Windows (x64)** | `raimand-ai-assistant-v<version>-windows-x64.zip` | Extract and double-click `start-raimand.bat` |

> **Runtime Prerequisites**: Both source builds and standalone releases require **Node.js `>= 20.9`** and **PostgreSQL `>= 14`**. Before first launch, create a PostgreSQL database (e.g. `app_db`), configure `DATABASE_URL` in `.env`, and push the Drizzle schema (`npx drizzle-kit push`).

---

## Quick Start (From Source)

### 1. Prerequisites
- **Node.js 20.9+** (required by Next.js 16)
- **PostgreSQL 14+**
- **Browser tool (optional)**: Google Chrome or Microsoft Edge installed, or use **Settings -> Browser -> Install Chromium** inside the app.

### 2. Clone & Install

```bash
git clone https://github.com/w15800974-debug/raimand-ai-assistant.git
cd raimand-ai-assistant
npm install
```

### 3. Configure Database & Environment

Create the PostgreSQL database:

```bash
createdb app_db
# Or via psql:
# psql -U postgres -c "CREATE DATABASE app_db;"
```

Copy `.env.example` to `.env` and update `DATABASE_URL` if needed:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
# DISPLAY=:0 # Optional on Linux for headed Playwright mode
```

> **Note**: `drizzle.config.json` also contains `dbCredentials.url`. If you use a custom `DATABASE_URL`, update `drizzle.config.json` to match before running `drizzle-kit push`.

Push the database schema from `src/db/schema.ts`:

```bash
npx drizzle-kit push
```

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first launch, the `/onboarding` wizard guides you through setting your display name, selecting a sandboxed workspace folder, and configuring your AI provider (Base URL, API key, and model). API keys are stored in your local PostgreSQL database, not in `.env`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port `3000` |
| `npm run build` | Build production bundle (requires valid `DATABASE_URL` env var) |
| `npm run start` | Start built production server |
| `npm run lint` | Run ESLint across the codebase |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npx drizzle-kit push` | Push `src/db/schema.ts` to PostgreSQL |

---

## Project Architecture

```text
.
├── docs/workflows/          # Ready-to-use CI & cross-platform Linux/Windows Release workflows
├── src/
│   ├── app/
│   │   ├── (app)/           # Main authenticated shell: chat, projects, files, connections, schedules, memory, settings
│   │   ├── onboarding/      # 3-step first-run setup wizard
│   │   ├── api/             # REST & streaming Route Handlers (/api/chat, /api/mcp, /api/files, /api/schedules, etc.)
│   │   └── globals.css      # Tailwind CSS 4 + RTL styling
│   ├── components/          # AppShell, ChatView, MessageView, UIFrame, FolderPicker, ProviderForm
│   ├── db/                  # Drizzle ORM + pg connection pool & schema (10 tables)
│   ├── lib/
│   │   ├── agent.ts         # Multi-step autonomous agent loop
│   │   ├── llm.ts           # OpenAI-compatible streaming client
│   │   ├── mcp.ts           # Model Context Protocol (MCP) client
│   │   ├── scheduler.ts     # Cron & one-off task runner
│   │   ├── paths.ts         # Workspace path sandboxing
│   │   ├── approvals.ts     # Tool execution permission manager
│   │   ├── docs/            # Native PDF, DOCX, PPTX, XML generators
│   │   └── tools/           # Agent tools: fs, docs, web, system, browser
│   └── instrumentation.ts   # Node.js runtime startup hook for the scheduler
├── drizzle.config.json
├── next.config.ts
└── package.json
```

### API Endpoints

| Route | Purpose |
|---|---|
| `/api/health` | Database health check (`select 1`) |
| `/api/chat`, `/api/chat/stop` | Streaming chat & agent execution / cancellation |
| `/api/conversations`, `/api/conversations/[id]` | Conversation CRUD |
| `/api/projects` | Project management |
| `/api/providers`, `/api/providers/[id]/models` | Model provider configuration & model discovery |
| `/api/files`, `/api/files/upload`, `/api/files/preview`, `/api/files/raw` | Workspace file browser, upload, preview & download |
| `/api/fs/browse` | Local directory picker |
| `/api/mcp`, `/api/mcp/[id]` | MCP server connections & tool discovery |
| `/api/memories` | Long-term memory management |
| `/api/schedules`, `/api/schedules/run` | Scheduled tasks & manual trigger |
| `/api/settings`, `/api/tools`, `/api/browser/install` | Settings, tool permissions & Chromium installer |

---

## Contributing & Security

- Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a Pull Request.
- For security vulnerabilities or sandboxing questions, see [SECURITY.md](SECURITY.md).

## License

Licensed under the [MIT License](LICENSE) — Copyright (c) 2026 Ali Hajian (`w15800974-debug`).
