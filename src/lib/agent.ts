import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, conversations, memories, messages, projects, providers } from "@/db/schema";
import { addGrant, hasGrant, requestApproval } from "./approvals";
import { applyEvent, type AgentEvent, type Part } from "./events";
import { completeText, streamChat, type ChatMsg, type Provider } from "./llm";
import { callMcpTool } from "./mcp";
import { getRoots, mimeOf } from "./paths";
import { getSettings, type AppSettings, type Policy } from "./settings";
import { buildToolset } from "./tools";
import type { ToolCtx } from "./tools/types";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + `\n…[${s.length - n} نویسهٔ دیگر کوتاه شد]` : s;
}

async function buildSystemPrompt(opts: {
  settings: AppSettings;
  mode: "chat" | "agent";
  project?: typeof projects.$inferSelect;
  mems: { content: string; category: string }[];
}) {
  const { settings, mode, project, mems } = opts;
  const roots = await getRoots();
  const now = new Date();
  const fa = new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short", timeZone: settings.timezone }).format(now);
  const lines: string[] = [];
  lines.push(`تو «رایمند» (Raymind) هستی؛ یک دستیار هوش مصنوعی همه‌کاره، دقیق و دوستانه با رابط فارسی. به زبان کاربر پاسخ بده (پیش‌فرض فارسی روان و حرفه‌ای). پاسخ‌ها را با Markdown خوانا و مختصر بنویس.`);
  lines.push(`زمان کنونی: ${fa} (${now.toISOString()}) — منطقهٔ زمانی ${settings.timezone}. سیستم‌عامل: ${process.platform}.`);
  if (settings.userName) lines.push(`نام کاربر: ${settings.userName}`);
  lines.push(`پوشهٔ اصلی کار (workspace): ${roots[0]}${roots.length > 1 ? `\nپوشه‌های متصل دیگر: ${roots.slice(1).join(" ، ")}` : ""}\nمسیرهای نسبی نسبت به پوشهٔ اصلی هستند.`);
  if (project) {
    lines.push(`## پروژهٔ فعال: ${project.name}\n${project.description}\n${project.instructions ? `دستورالعمل‌های پروژه:\n${project.instructions}` : ""}${project.folder ? `\nپوشهٔ پروژه (نسبی): ${project.folder} — فایل‌های این پروژه را آنجا بساز و بخوان.` : ""}`);
  }
  if (settings.customInstructions) lines.push(`## دستورالعمل‌های کاربر\n${settings.customInstructions}`);
  if (settings.memoryEnabled && mems.length) {
    lines.push(`## حافظهٔ بلندمدت دربارهٔ کاربر\n${mems.map((m) => `- ${m.content}`).join("\n")}\n(با ابزار memory_save موارد پایدار و مهم جدید را ذخیره کن؛ مثل ترجیحات، اطلاعات پروفایل و تصمیم‌های پروژه. موارد گذرا را ذخیره نکن.)`);
  }
  lines.push(`## قواعد استفاده از ابزارها
- کارها را واقعاً با ابزار انجام بده؛ هرگز ادعا نکن فایلی ساخته یا تغییر داده‌ای مگر ابزار موفق بوده باشد. بعد از ساخت/ویرایش فایل، مسیر دقیق را به کاربر بگو.
- **اسناد**: برای PowerPoint/Word/PDF از pptx_create / docx_create / pdf_create استفاده کن و محتوای کامل، غنی و باکیفیت بساز (آزمون، جزوه، گزارش، ارائه حرفه‌ای با طراحی و رنگ‌بندی مناسب). برای ویرایش، اول با doc_read فایل را بخوان، سپس با pptx_edit / docx_edit / pdf_edit (یا در موارد خاص office_xml) تغییر واقعی بده. مثلاً «رنگ اسلاید دوم را آبی کن» = doc_read سپس pptx_edit با set_slide_background (رنگ هگز مثل 2563EB). رنگ‌ها را همیشه به صورت هگز بده.
- **رابط تعاملی (Generative UI)**: هر وقت داشبورد، نمودار، فرم، ماشین‌حساب، شبیه‌ساز، بازی، جدول تعاملی، طرح اولیهٔ صفحه یا پیش‌نمایش کدی خواستند یا مفید بود، از render_ui استفاده کن. HTML/CSS/JS کامل و کارا، راست‌چین، زیبا و واقعاً تعاملی بنویس (نه نمونهٔ ناقص). بعد از آن فقط یک توضیح کوتاه بده.
- **مرورگر**: برای کار روی وب از ابزار browser استفاده کن (open → snapshot → click/type). قبل از اقدام‌های حساس (پرداخت، حذف، ارسال) از کاربر تأیید بگیر. برای جست‌وجوی ساده web_search و web_fetch سریع‌ترند.
- **کد**: برای محاسبه، پردازش داده و تست از run_code استفاده کن.
- **فایل‌ها**: فقط داخل پوشه‌های مجاز کار کن. قبل از بازنویسی فایل موجود آن را بخوان.
- اگر ابزاری خطا داد، علت را بخوان و راه دیگری امتحان کن؛ بی‌دلیل تکرار نکن.
- اطلاعات حساس (کلید API و رمز) را هرگز در پاسخ یا فایل‌ها فاش نکن.`);
  if (mode === "agent") {
    lines.push(`## حالت عامل (Agent Mode)
تو در حالت عامل خودکار هستی. کارهای پیچیده را تا رسیدن به نتیجهٔ نهایی خودت پیش ببر:
1. ابتدا با update_plan یک برنامهٔ مرحله‌ای مشخص (۳ تا ۸ گام) منتشر کن.
2. گام‌ها را یکی‌یکی با ابزارها اجرا کن و بعد از هر گام وضعیت برنامه را با update_plan به‌روز کن (running/done/failed).
3. نتایج را راستی‌آزمایی کن (مثلاً فایل ساخته‌شده را با doc_read بخوان).
4. در پایان گزارش نهایی بنویس: خلاصهٔ کار انجام‌شده، فایل‌های خروجی (با مسیر) و نکات بعدی.
بدون سؤال اضافه جلو برو؛ فقط وقتی اطلاعات ضروری نداری بپرس.`);
  } else {
    lines.push(`## حالت چت\nمستقیم و مفید پاسخ بده. فقط وقتی لازم است از ابزار استفاده کن. اگر کار بزرگ و چندمرحله‌ای بود می‌توانی پیشنهاد دهی حالت «عامل» را روشن کند، اما تا جای ممکن همین‌جا انجامش بده.`);
  }
  return lines.join("\n\n");
}

export type TurnParams = {
  conversationId: string;
  text: string;
  attachments?: { path: string; name: string; mime?: string }[];
  mode: "chat" | "agent";
  autoApprove?: boolean;
  emit: (e: AgentEvent) => void;
  signal: AbortSignal;
  origin?: string;
};

export async function runTurn(p: TurnParams): Promise<{ text: string; ok: boolean; error?: string }> {
  const { conversationId, signal } = p;
  const settings = await getSettings();
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!conv) throw new Error("گفتگو پیدا نشد");

  let provider: Provider | undefined;
  const pid = conv.providerId ?? settings.activeProviderId;
  if (pid) [provider] = await db.select().from(providers).where(eq(providers.id, pid));
  if (!provider) [provider] = await db.select().from(providers).orderBy(asc(providers.id)).limit(1);
  const model = (conv.model || provider?.model || "").trim();

  const project = conv.projectId ? (await db.select().from(projects).where(eq(projects.id, conv.projectId)))[0] : undefined;
  const mems = settings.memoryEnabled ? await db.select().from(memories).orderBy(desc(memories.id)).limit(40) : [];

  const rows = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
  const recent = rows.filter((r) => r.status !== "running").slice(-40);
  const history: ChatMsg[] = [];
  recent.forEach((r, i) => {
    const old = i < recent.length - 6;
    for (const m of (r.llm as ChatMsg[]) || []) {
      if (old && m.role === "tool" && typeof m.content === "string") history.push({ ...m, content: trunc(m.content, 1200) });
      else history.push(m);
    }
  });

  const attachNote = (p.attachments || []).map((a) => `[پیوست: ${a.name} ← ${a.path}]`).join("\n");
  const userText = [p.text, attachNote].filter(Boolean).join("\n\n");
  const userParts: Part[] = [{ type: "text", text: p.text }];
  const images: string[] = [];
  for (const a of p.attachments || []) {
    const ext = path.extname(a.name).toLowerCase();
    userParts.push({ type: "file", path: a.path, name: a.name, image: IMAGE_EXT.has(ext) });
    if (IMAGE_EXT.has(ext)) {
      try {
        const buf = await fs.readFile(a.path);
        if (buf.length < 8_000_000) images.push(`data:${mimeOf(a.path)};base64,${buf.toString("base64")}`);
      } catch {
        /* ignore */
      }
    }
  }
  const userMsgDb: ChatMsg = { role: "user", content: userText };
  const userMsgLive: ChatMsg = images.length
    ? { role: "user", content: [{ type: "text", text: userText }, ...images.map((u) => ({ type: "image_url", image_url: { url: u } }))] }
    : userMsgDb;
  const [userRow] = await db.insert(messages).values({ conversationId, role: "user", parts: userParts, llm: [userMsgDb], status: "done" }).returning();
  const [asstRow] = await db.insert(messages).values({ conversationId, role: "assistant", parts: [], llm: [], status: "running" }).returning();
  p.emit({ type: "meta", conversationId, userMessageId: userRow.id, assistantMessageId: asstRow.id });

  let parts: Part[] = [];
  const newLlm: ChatMsg[] = [];
  let lastFlush = 0;
  const flush = async (force = false, status?: string) => {
    const t = Date.now();
    if (!force && t - lastFlush < 1200) return;
    lastFlush = t;
    await db.update(messages).set({ parts, llm: newLlm, ...(status ? { status } : {}) }).where(eq(messages.id, asstRow.id));
  };
  const emit = (e: AgentEvent) => {
    parts = applyEvent(parts, e);
    p.emit(e);
    void flush().catch(() => {});
  };

  const ctx: ToolCtx = {
    conversationId,
    mode: p.mode,
    signal,
    settings,
    origin: p.origin || "",
    emit,
    fileCreated: async (abs: string) => {
      const ext = path.extname(abs).toLowerCase();
      const name = path.basename(abs);
      emit({ type: "file", path: abs, name, image: IMAGE_EXT.has(ext) });
      const existing = await db.select().from(artifacts).where(eq(artifacts.path, abs));
      if (existing.length) await db.update(artifacts).set({ createdAt: new Date(), conversationId }).where(eq(artifacts.id, existing[0].id));
      else await db.insert(artifacts).values({ path: abs, name, kind: ext.replace(".", "") || "file", conversationId });
    },
  };

  let finalText = "";
  let ok = true;
  let errMsg: string | undefined;
  try {
    if (!provider || !model) throw new Error("هنوز ارائه‌دهندهٔ هوش مصنوعی یا مدل تنظیم نشده است. از «تنظیمات ← ارائه‌دهندگان» یک API Key و مدل اضافه کنید.");
    const { specs, map } = await buildToolset(p.mode);
    const system = await buildSystemPrompt({ settings, mode: p.mode, project, mems });
    const llmMsgs: ChatMsg[] = [{ role: "system", content: system }, ...history, userMsgLive];
    const maxSteps = p.mode === "agent" ? settings.maxAgentSteps : 12;
    let step = 0;
    let hitLimit = false;

    while (true) {
      if (step >= maxSteps) {
        hitLimit = true;
        break;
      }
      step++;
      let text = "";
      let calls: { id: string; name: string; args: string }[] = [];
      for await (const ev of streamChat({ provider, model, messages: llmMsgs, tools: specs, signal })) {
        if (ev.type === "text") {
          text += ev.delta;
          emit({ type: "text", delta: ev.delta });
        } else if (ev.type === "reasoning") emit({ type: "reasoning", delta: ev.delta });
        else if (ev.type === "tool_calls") calls = ev.calls;
      }
      finalText += text;
      const asst: ChatMsg = {
        role: "assistant",
        content: text || null,
        ...(calls.length ? { tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } })) } : {}),
      };
      llmMsgs.push(asst);
      newLlm.push(asst);
      if (!calls.length) break;
      for (const call of calls) {
        const content = await execTool(call, map, ctx, p.autoApprove ?? false, () => flush(true));
        const toolMsg: ChatMsg = { role: "tool", tool_call_id: call.id, content };
        llmMsgs.push(toolMsg);
        newLlm.push(toolMsg);
        if (signal.aborted) break;
      }
      if (signal.aborted) break;
    }
    if (hitLimit) emit({ type: "text", delta: `\n\n> ⏸️ به سقف ${maxSteps} مرحله رسیدم. اگر می‌خواهید ادامه بدهم، بنویسید «ادامه بده».` });
  } catch (e) {
    if (signal.aborted) {
      ok = true;
    } else {
      ok = false;
      errMsg = e instanceof Error ? e.message : String(e);
      emit({ type: "error", message: errMsg });
    }
  }

  const answered = new Set(newLlm.filter((m) => m.role === "tool").map((m) => m.tool_call_id));
  for (const m of [...newLlm]) {
    for (const tc of m.tool_calls || []) if (!answered.has(tc.id)) newLlm.push({ role: "tool", tool_call_id: tc.id, content: "لغو شد." });
  }
  parts = parts.map((pt) => (pt.type === "tool" && (pt.status === "running" || pt.status === "awaiting") ? { ...pt, status: "error" as const, result: "لغو شد" } : pt));
  await flush(true, signal.aborted ? "stopped" : ok ? "done" : "error");

  try {
    if (conv.title === "گفتگوی جدید" && p.text) {
      let title = p.text.replace(/\s+/g, " ").slice(0, 48);
      if (provider && model && ok && !signal.aborted) {
        const t = await completeText(provider, model, [
          { role: "system", content: "یک عنوان بسیار کوتاه (حداکثر ۵ کلمه) به زبان فارسی برای این گفتگو بنویس. فقط خود عنوان، بدون نقل‌قول و نقطه." },
          { role: "user", content: `${p.text.slice(0, 400)}\n\nپاسخ: ${finalText.slice(0, 300)}` },
        ]).catch(() => "");
        if (t) title = t.replace(/["«»\n]/g, "").slice(0, 60);
      }
      await db.update(conversations).set({ title }).where(eq(conversations.id, conversationId));
      p.emit({ type: "title", title });
    }
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  } catch {
    /* ignore */
  }
  p.emit({ type: "done" });
  return { text: finalText, ok, error: errMsg };
}

async function execTool(
  call: { id: string; name: string; args: string },
  map: Awaited<ReturnType<typeof buildToolset>>["map"],
  ctx: ToolCtx,
  autoApprove: boolean,
  flushNow: () => Promise<void>,
): Promise<string> {
  let args: unknown = {};
  try {
    args = call.args ? JSON.parse(call.args) : {};
  } catch {
    ctx.emit({ type: "tool_start", id: call.id, name: call.name, args: call.args });
    ctx.emit({ type: "tool_end", id: call.id, status: "error", result: "آرگومان‌ها JSON معتبر نبود", ms: 0 });
    return "خطا: آرگومان‌های ابزار JSON معتبر نبود. دوباره با JSON صحیح فراخوانی کن.";
  }
  ctx.emit({ type: "tool_start", id: call.id, name: call.name, args });
  const tool = map.get(call.name);
  if (!tool) {
    ctx.emit({ type: "tool_end", id: call.id, status: "error", result: "ابزار ناشناخته", ms: 0 });
    return `خطا: ابزاری با نام ${call.name} وجود ندارد.`;
  }

  let policy: Policy = "allow";
  let key = "";
  if (tool.mcp) {
    policy = (tool.mcp.row.permission as Policy) || "ask";
    key = `mcp:${tool.mcp.row.id}`;
  } else if (tool.category) {
    policy = ctx.settings.permissions[tool.category] || "ask";
    key = tool.category;
  }
  if (policy === "deny") {
    ctx.emit({ type: "tool_end", id: call.id, status: "denied", result: "این دسترسی در تنظیمات غیرفعال است.", ms: 0 });
    return "دسترسی به این ابزار توسط کاربر ممنوع شده است.";
  }
  if (policy === "ask" && !autoApprove && !hasGrant(ctx.conversationId, key)) {
    const approvalId = randomUUID();
    ctx.emit({ type: "tool_approval", id: call.id, approvalId, category: tool.mcp ? `mcp:${tool.mcp.row.name}` : tool.category || "" });
    await flushNow().catch(() => {});
    const d = await requestApproval(approvalId, ctx.signal);
    if (d === "deny") {
      ctx.emit({ type: "tool_end", id: call.id, status: "denied", result: "کاربر اجازه نداد.", ms: 0 });
      return "کاربر اجرای این ابزار را رد کرد. بدون آن ادامه بده یا از کاربر بپرس.";
    }
    if (d === "session") addGrant(ctx.conversationId, key);
    ctx.emit({ type: "tool_resume", id: call.id });
  }

  const t0 = Date.now();
  try {
    let result: unknown;
    if (tool.mcp) result = await callMcpTool(tool.mcp.row, tool.mcp.tool, args, ctx.signal);
    else result = await tool.def!.run(args, ctx);
    const s = typeof result === "string" ? result : JSON.stringify(result, null, 1);
    ctx.emit({ type: "tool_end", id: call.id, status: "done", result: trunc(s, 3500), ms: Date.now() - t0 });
    return trunc(s, 12000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.emit({ type: "tool_end", id: call.id, status: "error", result: msg.slice(0, 1500), ms: Date.now() - t0 });
    return `خطا: ${msg}`;
  }
}
