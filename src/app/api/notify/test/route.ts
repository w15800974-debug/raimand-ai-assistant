import { fail, guard, ok } from "@/lib/http";
import { sendBaleMessage, sendTelegramMessage } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json().catch(() => ({}));
    const s = await getSettings();
    const channel = String(b.channel || "");
    const sample = "✅ پیام آزمایشی از رایمند (نسخه ۲.۰)\nاتصال اعلان‌های خودکار زمان‌بند با موفقیت برقرار شد.";

    if (channel === "telegram") {
      const token = String(b.token || s.telegramBotToken || "");
      const chatId = String(b.chatId || s.telegramChatId || "");
      await sendTelegramMessage(token, chatId, sample);
      return ok({ ok: true, message: "پیام آزمایشی به تلگرام ارسال شد." });
    }
    if (channel === "bale") {
      const token = String(b.token || s.baleBotToken || "");
      const chatId = String(b.chatId || s.baleChatId || "");
      await sendBaleMessage(token, chatId, sample);
      return ok({ ok: true, message: "پیام آزمایشی به بله ارسال شد." });
    }
    return fail("کانال نامعتبر است (telegram یا bale).");
  });
}
