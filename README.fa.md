<div dir="rtl">

<div align="center">

# رایمند (Raimand) نسخه ۲.۰ — اپلیکیشن دسکتاپ و دستیار هوش مصنوعی فارسی

**پلتفرم متن‌باز دستیار هوش مصنوعی و عامل هوشمند با رابط کاربری راست‌چین (RTL)، ساخته شده با Electron، Next.js 16، PostgreSQL، پروتکل MCP، Playwright و تولید واقعی اسناد.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![GitHub Release](https://img.shields.io/github/v/release/w15800974-debug/raimand-ai-assistant?include_prereleases&label=Release)](https://github.com/w15800974-debug/raimand-ai-assistant/releases)

[فارسی](README.fa.md) | [English](README.md)

</div>

---

## قابلیت‌های جدید در نسخه ۲.۰.۰

- **مقایسهٔ هم‌زمان مدل‌ها (Arena / Split View):** ارسال یک پیام به‌صورت هم‌زمان به دو مدل یا ارائه‌دهندهٔ مختلف و نمایش زندهٔ پاسخ‌ها کنار هم همراه با زمان پاسخ‌دهی (`/arena`).
- **دستیار Git و بازبینی کد:** ابزارهای داخلی `git_status`، `git_diff`، `git_log` و `git_commit` برای بررسی تغییرات کد، یافتن باگ، تولید پیام کامیت و ثبت کامیت با تأیید کاربر.
- **ارسال خروجی زمان‌بند به تلگرام و بله:** ارسال خودکار گزارش اجرای وظایف زمان‌بندی‌شده به **ربات تلگرام** یا **بازوی پیام‌رسان بله** (با دکمهٔ تست اتصال در بخش تنظیمات).
- **جست‌وجوی سراسری (Command Palette با `Ctrl+K`):** دسترسی و جابه‌جایی سریع با کیبورد بین گفتگوها، فایل‌های پوشهٔ کاری، پروژه‌ها، صفحات و تغییر تم.

---

## معرفی پروژه

**رایمند (Raimand)** یک اپلیکیشن دسکتاپ و وب متن‌باز و خودمیزبان (Self-Hosted) با رابط کاربری فارسی و راست‌چین (`Vazirmatn`) است. این برنامه با **Electron** بسته‌بندی شده تا در **ویندوز** و **لینوکس** دقیقاً مثل یک برنامهٔ مستقل نصب و در پنجرهٔ اختصاصی خود اجرا شود (بدون نیاز به باز کردن مرورگر یا نصب جداگانهٔ Node.js). رایمند به هر ارائه‌دهندهٔ سازگار با **OpenAI API** (مانند OpenAI، OpenRouter، Groq یا مدل‌های محلی مثل Ollama) متصل می‌شود و تمام کلیدهای API، گفتگوها، حافظهٔ بلندمدت و فایل‌ها را روی سیستم خودتان نگهداری می‌کند.

## امکانات کلیدی

- **اپلیکیشن دسکتاپ بومی (ویندوز و لینوکس)**: نصب و اجرا در پنجرهٔ اختصاصی برنامه با Electron (`electron/main.cjs`) همراه با میانبر دسکتاپ و منوی استارت.
- **مقایسهٔ هم‌زمان مدل‌ها (Arena)**: سنجش هم‌زمان دو مدل مختلف کنار هم به‌صورت استریم و چندنوبتی.
- **چت هوشمند، حالت عامل و بازبینی کد Git**: اجرای چندمرحله‌ای ابزارها به‌صورت استریم با سیستم تأیید دسترسی (`allow` / `ask` / `deny`) و ابزارهای بومی Git.
- **مدیریت امن فایل‌ها (Sandboxed Workspace)**: خواندن، نوشتن، جست‌وجو، آپلود و پیش‌نمایش فایل‌ها صرفاً داخل پوشهٔ کاری مجاز و پوشه‌های متصل‌شده (`src/lib/paths.ts`).
- **ساخت و ویرایش واقعی اسناد**: تولید و پردازش فایل‌های **PDF**، **Word (`.docx`)** و **PowerPoint (`.pptx`)**.
- **اتوماسیون مرورگر و جست‌وجوی وب**: کنترل مرورگر با **Playwright** و پشتیبانی از موتورهای جست‌وجو (DuckDuckGo، Tavily، Brave، SearXNG).
- **پشتیبانی از سرورهای MCP**: کلاینت بومی `@modelcontextprotocol/sdk` برای اتصال ابزارهای خارجی.
- **زمان‌بند Cron همراه با اعلان تلگرام و بله**: اجرای خودکار وظایف دوره‌ای و ارسال گزارش نتیجه به تلگرام یا بله.
- **جست‌وجوی سراسری (`Ctrl+K`)**: جابه‌جایی سریع بین همه بخش‌های برنامه با کیبورد.

---

## دانلود اپلیکیشن دسکتاپ (ویندوز و لینوکس)

نسخه‌های نصبی و پرتابل برای **ویندوز** و **لینوکس** در بخش [Releases گیت‌هاب](https://github.com/w15800974-debug/raimand-ai-assistant/releases) منتشر می‌شوند:

| سیستم‌عامل | فرمت بسته | نحوه نصب و اجرا |
|---|---|---|
| **ویندوز (نصاب استاندارد)** | `Raimand AI Assistant Setup <version>.exe` | دوبار کلیک برای نصب (ساخت میانبر در منوی استارت و دسکتاپ) |
| **ویندوز (نسخه پرتابل)** | `Raimand AI Assistant <version>.exe` | اجرا بدون نیاز به نصب |
| **لینوکس (اوبونتو / دبیان)** | `raimand-ai-assistant_<version>_amd64.deb` | نصب با `sudo dpkg -i raimand-ai-assistant_*.deb` و اجرا از منوی برنامه‌ها |
| **لینوکس (پرتابل)** | `Raimand AI Assistant-<version>.AppImage` | `chmod +x *.AppImage && ./Raimand*.AppImage` |

> **پیش‌نیاز اجرا**: اپلیکیشن دسکتاپ نیازی به نصب جداگانهٔ Node.js ندارد، اما برای ذخیرهٔ گفتگوها و تنظیمات باید **PostgreSQL نسخه ۱۴ به بالا** روی سیستم فعال باشد (ساخت دیتابیس `app_db` و اعمال اسکیما با `npx drizzle-kit push`).

---

## نصب و اجرا از سورس

```bash
git clone https://github.com/w15800974-debug/raimand-ai-assistant.git
cd raimand-ai-assistant
npm install
createdb app_db
cp .env.example .env
npx drizzle-kit push

# اجرای محیط توسعه وب
npm run dev

# یا بیلد و اجرای اپلیکیشن دسکتاپ Electron
npm run build
npm run electron:start
```

---

## مشارکت، امنیت و مجوز

- برای مشارکت در توسعه، راهنمای [CONTRIBUTING.md](CONTRIBUTING.md) را مطالعه کنید.
- برای گزارش مسائل امنیتی به [SECURITY.md](SECURITY.md) مراجعه نمایید.
- این پروژه تحت مجوز [MIT](LICENSE) منتشر شده است — علی حاجیان (`w15800974-debug`).

</div>
