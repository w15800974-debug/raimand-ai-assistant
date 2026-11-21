<div dir="rtl">

<div align="center">

# رایمند (Raimand) نسخه ۳.۰ — اپلیکیشن دسکتاپ و دستیار هوش مصنوعی دوزبانه

**پلتفرم متن‌باز دستیار هوش مصنوعی و عامل هوشمند با رابط دوزبانه (فارسی RTL و انگلیسی LTR)، ساخته شده با Electron، Next.js 16، PostgreSQL، پروتکل MCP، Playwright، حالت صوتی و تولید واقعی اسناد.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![GitHub Release](https://img.shields.io/github/v/release/w15800974-debug/raimand-ai-assistant?include_prereleases&label=Release)](https://github.com/w15800974-debug/raimand-ai-assistant/releases)

[فارسی](README.fa.md) | [English](README.md)

</div>

---

## قابلیت‌های جدید در نسخه ۳.۰.۰

- **ساخت و خواندن فایل‌های اکسل (`.xlsx`) با فرمول (`xlsx_create` و `xlsx_read`):** تولید فایل‌های اکسل چندبرگه‌ای، راست‌چین و فرمول‌دار (`=SUM(...)`) در کنار PDF، Word و PowerPoint.
- **حالت صوتی (ورودی و خروجی صدا):** دکمهٔ میکروفون در کادر گفتگو (تبدیل گفتار فارسی/انگلیسی به متن + پشتیبانی Whisper API) و دکمهٔ پخش صوتی پاسخ‌ها.
- **کتابخانهٔ پرامپت‌ها و دستورهای `/slash` (`/prompts`):** ذخیرهٔ پرامپت‌های پرکاربرد و فراخوانی آنی در کادر چت با تایپ `/`.
- **ویرایش پیام و تولید مجدد پاسخ:** امکان ویرایش و ارسال مجدد هر پیام قبلی کاربر یا بازتولید (Regenerate) پاسخ دستیار.
- **خروجی گفتگو و داشبورد آمار مصرف (`/analytics`):** دانلود هر گفتگو به فرمت **Markdown** یا **HTML/PDF** همراه با گزارش آمار گفتگوها، برآورد توکن‌ها و مدل‌های پرکاربرد.
- **System Tray و میانبر سراسری دسکتاپ:** اجرای پس‌زمینه کنار ساعت سیستم، باز کردن سریع با **`Alt+Space`** و اعلان بومی سیستم‌عامل.
- **رابط کاربری دوزبانه (فارسی RTL + انگلیسی LTR):** دکمهٔ تغییر آنی زبان کل برنامه (`FA / EN`) در سایدبار.
- **تولید تصویر و OCR اسناد اسکن‌شده (`generate_image` و `ocr_image`):** ساخت تصویر از طریق API و استخراج متن فارسی/انگلیسی از عکس‌ها.
- **پشتیبان‌گیری و بازیابی کامل (Backup & Restore):** دانلود و بازیابی کل گفتگوها، حافظه، پروژه‌ها، پرامپت‌ها و تنظیمات (بدون کلیدهای API) در یک فایل JSON.

### امکانات کلیدی نسخه ۲.۰.۰
- **مقایسهٔ هم‌زمان مدل‌ها (Arena / Split View)**
- **دستیار Git و بازبینی کد (`git_status`، `git_diff`، `git_log`، `git_commit`)**
- **ارسال گزارش زمان‌بند به تلگرام و پیام‌رسان بله**
- **جست‌وجوی سراسری (`Ctrl+K`)**

---

## دانلود اپلیکیشن دسکتاپ (ویندوز و لینوکس)

نسخه‌های نصبی و پرتابل برای **ویندوز** و **لینوکس** در بخش [Releases گیت‌هاب](https://github.com/w15800974-debug/raimand-ai-assistant/releases) منتشر می‌شوند:

| سیستم‌عامل | فرمت بسته | نحوه نصب و اجرا |
|---|---|---|
| **ویندوز (نصاب استاندارد)** | `Raimand AI Assistant Setup <version>.exe` | دوبار کلیک برای نصب (ساخت میانبر در منوی استارت و دسکتاپ) |
| **ویندوز (نسخه پرتابل)** | `Raimand AI Assistant <version>.exe` | اجرا بدون نیاز به نصب |
| **لینوکس (اوبونتو / دبیان)** | `raimand-ai-assistant_<version>_amd64.deb` | نصب با `sudo dpkg -i raimand-ai-assistant_*.deb` و اجرا از منوی برنامه‌ها |
| **لینوکس (پرتابل)** | `Raimand AI Assistant-<version>.AppImage` | `chmod +x *.AppImage && ./Raimand*.AppImage` |

> **پیش‌نیاز اجرا**: اپلیکیشن دسکتاپ نیازی به نصب جداگانهٔ Node.js ندارد، اما باید **PostgreSQL نسخه ۱۴ به بالا** روی سیستم فعال باشد (`createdb app_db` و `npx drizzle-kit push`).

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
