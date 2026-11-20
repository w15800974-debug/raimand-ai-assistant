import { getSettings } from "./settings";

const MAX_LEN = 3800;

function trimMsg(s: string) {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN) + "\n… [ادامه پیام کوتاه شد]" : s;
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const token = botToken.trim();
  const chat = chatId.trim();
  if (!token || !chat) throw new Error("توکن ربات و شناسه چت تلگرام الزامی است.");

  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: trimMsg(text),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `خطای تلگرام (${res.status})`);
  }
  return { ok: true };
}

export async function sendBaleMessage(botToken: string, chatId: string, text: string) {
  const token = botToken.trim();
  const chat = chatId.trim();
  if (!token || !chat) throw new Error("توکن ربات و شناسه چت بله الزامی است.");

  const res = await fetch(`https://tapi.bale.ai/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: trimMsg(text),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `خطای بله (${res.status})`);
  }
  return { ok: true };
}

export async function notifyScheduleResult(opts: {
  name: string;
  ok: boolean;
  result: string;
  error?: string;
}) {
  const s = await getSettings();
  if (!s.notifyTelegramEnabled && !s.notifyBaleEnabled) return;

  const statusLine = opts.ok ? "✅ اجرا با موفقیت انجام شد" : "❌ اجرا با خطا متوقف شد";
  const body = opts.ok
    ? (opts.result || "خروجی متنی ثبت نشد.").trim()
    : (opts.error || "خطای نامشخص").trim();

  const text = `⏰ گزارش زمان‌بندی رایمند\n📌 وظیفه: ${opts.name}\n${statusLine}\n\n${body}`;

  const tasks: Promise<unknown>[] = [];
  if (s.notifyTelegramEnabled && s.telegramBotToken && s.telegramChatId) {
    tasks.push(sendTelegramMessage(s.telegramBotToken, s.telegramChatId, text).catch(() => {}));
  }
  if (s.notifyBaleEnabled && s.baleBotToken && s.baleChatId) {
    tasks.push(sendBaleMessage(s.baleBotToken, s.baleChatId, text).catch(() => {}));
  }
  await Promise.allSettled(tasks);
}
