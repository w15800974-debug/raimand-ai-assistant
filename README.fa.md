<div dir="rtl">

<div align="center">

# رایمند (Raimand) — دستیار هوش مصنوعی و عامل هوشمند فارسی

**پلتفرم متن‌باز دستیار هوش مصنوعی همه‌کاره با رابط کاربری راست‌چین (RTL)، ساخته شده با Next.js 16، PostgreSQL، پروتکل MCP، Playwright و تولید واقعی اسناد.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![GitHub Release](https://img.shields.io/github/v/release/w15800974-debug/raimand-ai-assistant?include_prereleases&label=Release)](https://github.com/w15800974-debug/raimand-ai-assistant/releases)

[فارسی](README.fa.md) | [English](README.md)

</div>

---

## معرفی پروژه

**رایمند (Raimand)** یک دستیار هوش مصنوعی متن‌باز و خودمیزبان (Self-Hosted) با رابط کاربری فارسی و راست‌چین (`Vazirmatn`) است که روی Next.js و PostgreSQL اجرا می‌شود. رایمند به هر ارائه‌دهندهٔ سازگار با **OpenAI API** (مانند OpenAI، OpenRouter، Groq یا مدل‌های محلی مثل Ollama) متصل می‌شود و تمام کلیدهای API، گفتگوها، حافظهٔ بلندمدت و فایل‌ها را به‌صورت امن روی سیستم خودتان نگهداری می‌کند.

## امکانات کلیدی

- **چت هوشمند و حالت عامل (Agent Mode)**: اجرای چندمرحله‌ای ابزارها به‌صورت استریم همراه با دکمه توقف و سیستم تأیید دسترسی (`allow` / `ask` / `deny`).
- **مدیریت امن فایل‌ها (Sandboxed Workspace)**: خواندن، نوشتن، جست‌وجو، آپلود و پیش‌نمایش فایل‌ها صرفاً داخل پوشهٔ کاری مجاز و پوشه‌های متصل‌شده (`src/lib/paths.ts`).
- **ساخت و ویرایش واقعی اسناد**: تولید و پردازش فایل‌های **PDF** (`pdfkit`, `pdf-lib`, `pdf-parse`)، **Word (`.docx`)** (`docx`, `mammoth`) و **PowerPoint (`.pptx`)** (`pptxgenjs`).
- **اتوماسیون مرورگر و جست‌وجوی وب**: کنترل مرورگر با **Playwright** (پشتیبانی از حالت headless و نمایشی و نصب‌کنندهٔ خودکار Chromium) و پشتیبانی از موتورهای جست‌وجو (Tavily، Brave، SearXNG).
- **پشتیبانی از سرورهای MCP**: کلاینت بومی `@modelcontextprotocol/sdk` برای اتصال ابزارهای خارجی و مدیریت آن‌ها از داخل رابط کاربری.
- **رابط‌های تعاملی (Generative UI)**: رندر ایمن ویجت‌ها و نمودارهای تعاملی (`Chart.js`) و پیش‌نمایش HTML.
- **حافظهٔ بلندمدت، پروژه‌ها و زمان‌بند Cron**: ذخیره‌سازی حافظه، دسته‌بندی پروژه‌ها و اجرای خودکار وظایف زمان‌بندی‌شدهٔ دوره‌ای (`cron`) و یک‌باره.
- **نسخه‌های آماده برای لینوکس و ویندوز**: ساخت خودکار بسته‌های اجرایی برای **لینوکس (`.deb` و `.tar.gz`)** و **ویندوز (`.zip`)** در بخش Releases.

---

## دانلود نسخه‌های آماده (لینوکس و ویندوز)

نسخه‌های آمادهٔ اجرا در بخش [Releases گیت‌هاب](https://github.com/w15800974-debug/raimand-ai-assistant/releases) منتشر می‌شوند:

| سیستم‌عامل | فرمت بسته | نحوه اجرای سریع |
|---|---|---|
| **لینوکس (اوبونتو / دبیان)** | `raimand-ai-assistant_<version>_amd64.deb` | نصب با `sudo dpkg -i raimand-ai-assistant_*.deb` و اجرا با دستور `raimand` |
| **لینوکس (نسخه پرتابل)** | `raimand-ai-assistant-v<version>-linux-x64.tar.gz` | استخراج فایل و اجرای `./start-raimand.sh` |
| **ویندوز (۶۴ بیتی)** | `raimand-ai-assistant-v<version>-windows-x64.zip` | استخراج فایل و اجرای `start-raimand.bat` |

> **پیش‌نیاز اجرا**: برای هر دو روش (نسخه آماده یا سورس)، نصب بودن **Node.js نسخه ۲۰.۹ به بالا** و **PostgreSQL نسخه ۱۴ به بالا** روی سیستم الزامی است. پیش از اولین اجرا، پایگاه داده (مثلاً `app_db`) را بسازید، `DATABASE_URL` را در فایل `.env` تنظیم کنید و جداول را با `npx drizzle-kit push` ایجاد نمایید.

---

## نصب و راه‌اندازی از سورس

### ۱) پیش‌نیازها
- **Node.js 20.9 یا جدیدتر**
- **PostgreSQL 14 به بالا**
- **ابزار مرورگر (اختیاری)**: نصب بودن Google Chrome یا Microsoft Edge، یا استفاده از مسیر «تنظیمات ← مرورگر ← نصب Chromium» در داخل برنامه.

### ۲) دریافت و نصب وابستگی‌ها

```bash
git clone https://github.com/w15800974-debug/raimand-ai-assistant.git
cd raimand-ai-assistant
npm install
```

### ۳) تنظیم پایگاه داده و متغیرهای محیطی

ساخت پایگاه داده در PostgreSQL:

```bash
createdb app_db
# یا با psql:
# psql -U postgres -c "CREATE DATABASE app_db;"
```

ساخت فایل `.env` از روی `.env.example`:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
# DISPLAY=:0 # اختیاری در لینوکس برای اجرای غیر headless مرورگر
```

> **نکته**: فایل `drizzle.config.json` نیز آدرس پیش‌فرض اتصال را دارد. در صورت تغییر `DATABASE_URL`، مقدار `dbCredentials.url` را در این فایل هم هماهنگ کنید.

ساخت جداول پایگاه داده:

```bash
npx drizzle-kit push
```

### ۴) اجرای برنامه

```bash
npm run dev
```

سپس آدرس `http://localhost:3000` را در مرورگر باز کنید. در اولین اجرا به صفحهٔ «شروع به کار» (`/onboarding`) هدایت می‌شوید تا نام، پوشهٔ کاری مجاز و ارائه‌دهندهٔ مدل (Base URL، کلید API و نام مدل) را تنظیم کنید.

---

## دستورهای توسعه

| دستور | کاربرد |
|---|---|
| `npm run dev` | اجرای محیط توسعه روی پورت ۳۰۰۰ |
| `npm run build` | ساخت نسخهٔ تولیدی (نیازمند تنظیم `DATABASE_URL`) |
| `npm run start` | اجرای نسخهٔ بیلدشده |
| `npm run lint` | بررسی کد با ESLint |
| `npm run typecheck` | بررسی تایپ‌ها با `tsc --noEmit` |
| `npx drizzle-kit push` | اعمال اسکیمای `src/db/schema.ts` روی پایگاه داده |

---

## مشارکت، امنیت و مجوز

- برای مشارکت در توسعه، راهنمای [CONTRIBUTING.md](CONTRIBUTING.md) را مطالعه کنید.
- برای گزارش مسائل امنیتی به [SECURITY.md](SECURITY.md) مراجعه نمایید.
- این پروژه تحت مجوز [MIT](LICENSE) منتشر شده است — علی حاجیان (`w15800974-debug`).

</div>
