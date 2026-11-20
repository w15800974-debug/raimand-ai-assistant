<div align="center">

# Raimand (رایمند) v2.0 — Autonomous Persian RTL AI Assistant

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

## What's New in v2.0.0

- **Side-by-Side Model Comparison Arena (`/arena`)**: Stream responses from two different AI models or providers concurrently in a split-screen view with real-time latency tracking and multi-turn comparison.
- **Built-in Git Assistant & Code Review Tools (`src/lib/tools/git.ts`)**: Inspect repository status (`git_status`), review staged/unstaged diffs (`git_diff`), browse commit history (`git_log`), and create approval-gated local commits (`git_commit`).
- **Telegram & Bale Scheduler Notifications (`src/lib/notify.ts`)**: Automatically deliver scheduled task reports to your **Telegram Bot** or **Bale Bot** (`tapi.bale.ai`) with one-click test alerts in Settings.
- **Global Command Palette (`Ctrl+K`)**: Instant keyboard navigation (`src/components/CommandPalette.tsx`) across conversations, workspace files, projects, pages, and quick actions.

---

## Overview

**Raimand (رایمند)** is an open-source, local-first AI assistant and autonomous agent **desktop application** (and self-hosted web app) designed from the ground up with first-class **Persian (RTL)** typography (`Vazirmatn`) and **local-first privacy**. Built on Electron, Next.js App Router, React 19, Drizzle ORM, and PostgreSQL, Raimand runs in its own dedicated native window on **Windows** and **Linux**, connecting to any **OpenAI-compatible API provider** (OpenAI, OpenRouter, Groq, or local LLMs such as Ollama/LM Studio) while keeping your API keys, conversations, long-term memories, and workspace files on your own machine.

## Key Features

- **Native Desktop App (Windows & Linux)**: Built with Electron (`electron/main.cjs`) — installs like a standard desktop program, launches in its own dedicated window (no browser tab required), and bundles Node.js inside.
- **Model Comparison Arena (Split View)**: Compare any two models side-by-side in real time with shared system instructions and latency measurement.
- **Autonomous Agent Mode & Git Code Review**: Multi-step tool execution loop (`src/lib/agent.ts`) with streaming responses, interactive approval policies (`allow` / `ask` / `deny`), and native Git tools (`git_status`, `git_diff`, `git_log`, `git_commit`).
- **Sandboxed Workspace File System**: Read, write, search, upload, preview, and organize files strictly within your configured `workspaceRoot` and explicitly attached folders (`src/lib/paths.ts`).
- **Native Document Generation & Parsing**: Create and edit real **PDF** (`pdfkit`, `pdf-lib`, `pdf-parse`), **Word `.docx`** (`docx`, `mammoth`), and **PowerPoint `.pptx`** (`pptxgenjs`) files directly from agent workflows.
- **Browser Automation & Web Research**: Integrated **Playwright** (`playwright-core`) browser control with automatic headless/headed switching and built-in Chromium installer, plus web search integrations (Tavily, Brave, SearXNG).
- **Model Context Protocol (MCP)**: Native MCP client (`@modelcontextprotocol/sdk`) to connect external tool servers and manage tools dynamically from the UI.
- **Generative UI & HTML Previews**: Interactive rendered UI frames (`UIFrame`) powered by local `Chart.js` and sandboxed HTML previews.
- **Long-Term Memory, Projects, Cron Scheduler & Bot Alerts**: Persistent memories, project-scoped workspaces, background cron scheduler, and automatic Telegram/Bale delivery.
- **Global Command Palette (`Ctrl+K`)**: Fast keyboard search across chats, projects, files, and settings.

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
- **Git** (optional, required for Git Assistant tools)

### 2. Clone & Install

```bash
git clone https://github.com/w15800974-debug/raimand-ai-assistant.git
cd raimand-ai-assistant
npm install
```

### 3. Configure Database & Environment

```bash
createdb app_db
cp .env.example .env
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

---

## Contributing & Security

- Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a Pull Request.
- For security vulnerabilities or sandboxing questions, see [SECURITY.md](SECURITY.md).

## License

Licensed under the [MIT License](LICENSE) — Copyright (c) 2026 Ali Hajian (`w15800974-debug`).
