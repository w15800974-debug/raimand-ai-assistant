<div align="center">

# Raimand (رایمند) — Autonomous Persian RTL AI Assistant

**A local-first, full-stack Desktop & Web AI Assistant and Autonomous Agent workspace built with Electron, Next.js 16, PostgreSQL, MCP, Playwright, and native document authoring.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![GitHub Release](https://img.shields.io/github/v/release/w15800974-debug/raimand-ai-assistant?include_prereleases&label=Release)](https://github.com/w15800974-debug/raimand-ai-assistant/releases)

[English](README.md) | [فارسی (Persian)](README.fa.md)

</div>

---

## Overview

**Raimand (رایمند)** is an open-source, local-first AI assistant and autonomous agent **desktop application** (and self-hosted web app) designed from the ground up with first-class **Persian (RTL)** typography (`Vazirmatn`) and **local-first privacy**. Built on Electron, Next.js App Router, React 19, Drizzle ORM, and PostgreSQL, Raimand runs in its own dedicated native window on **Windows** and **Linux**, connecting to any **OpenAI-compatible API provider** (OpenAI, OpenRouter, Groq, or local LLMs such as Ollama/LM Studio) while keeping your API keys, conversations, long-term memories, and workspace files on your own machine.

## Key Features

- **Native Desktop App (Windows & Linux)**: Built with Electron (`electron/main.cjs`) — installs like a standard desktop program, launches in its own dedicated window (no browser tab required), and bundles Node.js inside.
- **Autonomous Agent Mode**: Multi-step tool execution loop (`src/lib/agent.ts`) with streaming responses, stop controls, and interactive approval policies (`allow` / `ask` / `deny`).
- **Sandboxed Workspace File System**: Read, write, search, upload, preview, and organize files strictly within your configured `workspaceRoot` and explicitly attached folders (`src/lib/paths.ts`).
- **Native Document Generation & Parsing**: Create and edit real **PDF** (`pdfkit`, `pdf-lib`, `pdf-parse`), **Word `.docx`** (`docx`, `mammoth`), and **PowerPoint `.pptx`** (`pptxgenjs`) files directly from agent workflows.
- **Browser Automation & Web Research**: Integrated **Playwright** (`playwright-core`) browser control with automatic headless/headed switching and built-in Chromium installer, plus web search integrations (Tavily, Brave, SearXNG).
- **Model Context Protocol (MCP)**: Native MCP client (`@modelcontextprotocol/sdk`) to connect external tool servers and manage tools dynamically from the UI.
- **Generative UI & HTML Previews**: Interactive rendered UI frames (`UIFrame`) powered by local `Chart.js` and sandboxed HTML previews.
- **Long-Term Memory, Projects & Cron Scheduler**: Persistent memories, project-scoped workspaces, and a built-in Node.js background task scheduler (`cron-parser`) supporting recurring cron jobs and one-off tasks.

---

## Download Desktop App (Windows & Linux)

Installable native desktop packages are built for **Windows** and **Linux** on the [GitHub Releases](https://github.com/w15800974-debug/raimand-ai-assistant/releases) page:

| Platform | Package Format | Install & Launch |
|---|---|---|
| **Windows (Installer)** | `Raimand AI Assistant Setup <version>.exe` | Double-click to install (creates Start Menu & Desktop shortcuts) |
| **Windows (Portable)** | `Raimand AI Assistant <version>.exe` | Run directly without installation |
| **Linux (Ubuntu / Debian)** | `raimand-ai-assistant_<version>_amd64.deb` | `sudo dpkg -i raimand-ai-assistant_*.deb` then launch from app menu |
| **Linux (Portable)** | `Raimand AI Assistant-<version>.AppImage` | `chmod +x *.AppImage && ./Raimand*.AppImage` |

> **Database Prerequisite**: The desktop app bundles Node.js and Chromium automatically, and requires **PostgreSQL `>= 14`** running locally (`app_db` database with schema pushed via `npx drizzle-kit push`). On first launch, the desktop app creates a `.env` file in your OS user-data directory if one does not exist.

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

Push the database schema from `src/db/schema.ts`:

```bash
npx drizzle-kit push
```

### 4. Run as Web App or Desktop App

```bash
# Development web server (http://localhost:3000)
npm run dev

# Or build and launch the Electron Desktop App
npm run build
npm run electron:start

# Or build native installers (.deb / .AppImage / .exe)
npm run electron:build
```

On first launch, the `/onboarding` wizard guides you through setting your display name, selecting a sandboxed workspace folder, and configuring your AI provider (Base URL, API key, and model).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port `3000` |
| `npm run build` | Build production standalone bundle (requires `DATABASE_URL` env var) |
| `npm run start` | Start built production web server |
| `npm run electron:start` | Launch the Electron desktop window (after `npm run build`) |
| `npm run electron:build` | Build native desktop installers via `electron-builder` |
| `npm run lint` | Run ESLint across the codebase |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npx drizzle-kit push` | Push `src/db/schema.ts` to PostgreSQL |

---

## Project Architecture

```text
.
├── electron/
│   └── main.cjs             # Electron desktop shell & embedded Next.js server launcher
├── docs/workflows/          # Ready-to-use CI & Desktop Release (Windows/Linux) workflows
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

---

## Contributing & Security

- Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a Pull Request.
- For security vulnerabilities or sandboxing questions, see [SECURITY.md](SECURITY.md).

## License

Licensed under the [MIT License](LICENSE) — Copyright (c) 2026 Ali Hajian (`w15800974-debug`).
