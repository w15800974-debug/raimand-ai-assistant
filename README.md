<div align="center">

# Raimand (رایمند) v3.0 — Autonomous Bilingual AI Assistant

**A local-first, full-stack Desktop & Web AI Assistant and Autonomous Agent workspace built with Electron, Next.js 16, PostgreSQL, MCP, Playwright, Voice Mode, and native PDF/DOCX/PPTX/XLSX authoring.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![GitHub Release](https://img.shields.io/github/v/release/w15800974-debug/raimand-ai-assistant?include_prereleases&label=Release)](https://github.com/w15800974-debug/raimand-ai-assistant/releases)

[English](README.md) | [فارسی (Persian)](README.fa.md)

</div>

---

## What's New in v3.0.0

- **Excel (`.xlsx`) Authoring & Analysis (`xlsx_create`, `xlsx_read`)**: Create multi-sheet, RTL-aware Excel workbooks with styled headers and live Excel formulas (`=SUM(...)`, `=AVERAGE(...)`) alongside PDF, Word, and PowerPoint.
- **Voice Mode (STT & TTS)**: Microphone voice input (Web Speech API + Whisper `/api/audio/transcribe` fallback) and one-click Read Aloud on assistant messages.
- **Prompt Library & `/slash` Commands (`/prompts`)**: Save, categorize, and trigger reusable prompts directly from the chat composer by typing `/`.
- **Message Edit & Regenerate**: Edit any previous user message to branch & resend, or regenerate any assistant response cleanly.
- **Conversation Export & Usage Analytics (`/analytics`)**: Export any chat to **Markdown** or **HTML/Print-PDF**, and inspect usage metrics, estimated tokens, top models, and generated artifacts.
- **Native Desktop System Tray & Global Shortcut**: Minimize to tray so background schedules keep running, summon Raimand anywhere with `Alt+Space` (`Ctrl+Shift+R`), and receive native OS notifications.
- **Bilingual UI (Persian RTL + English LTR)**: One-click `FA / EN` language switcher in the sidebar with automatic `dir="rtl"` / `dir="ltr"` switching.
- **Image Generation & OCR (`generate_image`, `ocr_image`)**: Generate images via OpenAI-compatible Images APIs and extract Persian/English text from scanned images.
- **Full Backup & Restore (`/api/backup`)**: Export and restore conversations, memories, projects, prompts, and non-sensitive settings as JSON.

### Highlights from v2.0.0
- **Side-by-Side Model Comparison Arena (`/arena`)**
- **Built-in Git Assistant & Code Review Tools (`git_status`, `git_diff`, `git_log`, `git_commit`)**
- **Telegram & Bale Scheduler Notifications (`src/lib/notify.ts`)**
- **Global Command Palette (`Ctrl+K`)**

---

## Download Desktop App (Windows & Linux)

Installable native desktop packages are built automatically on the [GitHub Releases](https://github.com/w15800974-debug/raimand-ai-assistant/releases) page:

| Platform | Package Format | Install & Launch |
|---|---|---|
| **Windows (Installer)** | `Raimand AI Assistant Setup <version>.exe` | Double-click to install (Start Menu & Desktop shortcuts) |
| **Windows (Portable)** | `Raimand AI Assistant <version>.exe` | Run directly without installation |
| **Linux (Ubuntu / Debian)** | `raimand-ai-assistant_<version>_amd64.deb` | `sudo dpkg -i raimand-ai-assistant_*.deb` then launch from app menu |
| **Linux (Portable)** | `Raimand AI Assistant-<version>.AppImage` | `chmod +x *.AppImage && ./Raimand*.AppImage` |

> **Database Prerequisite**: Bundles Node.js and Chromium automatically; requires **PostgreSQL `>= 14`** running locally (`app_db` database with schema pushed via `npx drizzle-kit push`).

---

## Quick Start (From Source)

```bash
git clone https://github.com/w15800974-debug/raimand-ai-assistant.git
cd raimand-ai-assistant
npm install
createdb app_db
cp .env.example .env
npx drizzle-kit push

# Run web dev server (http://localhost:3000)
npm run dev

# Or build and launch the Electron Desktop App
npm run build
npm run electron:start
```

---

## Contributing, Security & License

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a Pull Request.
- See [SECURITY.md](SECURITY.md) for sandboxing architecture and vulnerability reporting.
- Licensed under the [MIT License](LICENSE) — Copyright (c) 2026 Ali Hajian (`w15800974-debug`).
