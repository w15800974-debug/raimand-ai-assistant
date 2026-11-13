import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { ensureWorkspace, internalDir, resolveSafe } from "@/lib/paths";
import { obj, str, num, bool, type ToolCtx, type ToolDef } from "./types";

type BS = { browser: Browser; context: BrowserContext; page: Page; downloads: string[]; headless: boolean };
const g = globalThis as typeof globalThis & { __rmBrowser?: BS };

const SNAP = `(() => {
  document.querySelectorAll('[data-rm]').forEach(e => e.removeAttribute('data-rm'));
  const sel = 'a[href],button,input,select,textarea,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=option],[onclick],[contenteditable=true],summary';
  const out = []; let i = 0;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || st.visibility === 'hidden' || st.display === 'none') continue;
    if (r.bottom < -200 || r.top > innerHeight * 2.5) continue;
    i++; el.setAttribute('data-rm', String(i));
    const tag = el.tagName.toLowerCase(); const type = el.getAttribute('type') || '';
    const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('name') || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
    let line = '[' + i + '] ' + tag + (type ? '(' + type + ')' : '') + ' "' + label + '"';
    if (el.href) line += ' -> ' + String(el.href).slice(0, 110);
    if ((tag === 'input' || tag === 'textarea') && el.value && type !== 'password') line += ' value="' + String(el.value).slice(0, 40) + '"';
    if (el.checked) line += ' [checked]';
    out.push(line);
    if (i >= 140) break;
  }
  const text = (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, 3500);
  return { title: document.title, url: location.href, elements: out, text, scrollY: Math.round(scrollY), height: document.documentElement.scrollHeight };
})()`;

async function launch(headless: boolean): Promise<Browser> {
  const attempts: Record<string, unknown>[] = [{}, { channel: "chrome" }, { channel: "msedge" }];
  let lastErr: unknown;
  for (const extra of attempts) {
    try {
      return await chromium.launch({ headless, args: ["--disable-blink-features=AutomationControlled"], ...extra });
    } catch (e) {
      lastErr = e;
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message.split("\n")[0] : String(lastErr);
  throw new Error(`مرورگر اجرا نشد (${msg}). Google Chrome / Edge نصب کنید یا از «تنظیمات ← مرورگر ← نصب Chromium» استفاده کنید.`);
}

async function ensure(ctx: ToolCtx): Promise<BS> {
  const cur = g.__rmBrowser;
  if (cur && cur.browser.isConnected()) {
    if (cur.page.isClosed()) {
      const pages = cur.context.pages();
      cur.page = pages[pages.length - 1] ?? (await cur.context.newPage());
    }
    return cur;
  }
  const headless = ctx.settings.browserHeadless;
  const browser = await launch(headless);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 }, locale: "fa-IR" });
  const dlDir = path.join(await ensureWorkspace(), "downloads");
  await fs.mkdir(dlDir, { recursive: true });
  const st: BS = { browser, context, page: await context.newPage(), downloads: [], headless };
  const attach = (p: Page) => {
    p.on("download", async (d) => {
      const file = path.join(dlDir, d.suggestedFilename());
      await d.saveAs(file).catch(() => {});
      st.downloads.push(file);
    });
  };
  attach(st.page);
  context.on("page", (p) => {
    attach(p);
    st.page = p;
  });
  browser.on("disconnected", () => {
    if (g.__rmBrowser === st) g.__rmBrowser = undefined;
  });
  g.__rmBrowser = st;
  return st;
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {});
}

async function shot(page: Page, ctx: ToolCtx, full = false) {
  const dir = await internalDir("screenshots");
  const file = path.join(dir, `shot-${Date.now()}.png`);
  await page.screenshot({ path: file, type: "png", fullPage: full, timeout: 15000 }).catch(() => {});
  try {
    await fs.access(file);
    ctx.emit({ type: "file", path: file, name: "اسکرین‌شات مرورگر", image: true });
    return file;
  } catch {
    return undefined;
  }
}

async function snapshot(page: Page) {
  const s = (await page.evaluate(SNAP).catch(() => null)) as null | { title: string; url: string; elements: string[]; text: string; scrollY: number; height: number };
  if (!s) return { url: page.url(), note: "snapshot ناموفق بود" };
  return { url: s.url, title: s.title, scrollY: s.scrollY, pageHeight: s.height, elements: s.elements.join("\n"), visibleText: s.text };
}

function locate(page: Page, a: any) {
  if (a.ref !== undefined && a.ref !== null) return page.locator(`[data-rm="${a.ref}"]`).first();
  if (a.selector) return page.locator(String(a.selector)).first();
  if (a.text) return page.getByText(String(a.text), { exact: false }).first();
  throw new Error("برای این عمل ref (از snapshot) یا selector یا text لازم است.");
}

export async function closeBrowser() {
  const cur = g.__rmBrowser;
  g.__rmBrowser = undefined;
  if (cur) await cur.browser.close().catch(() => {});
}

export const browserTools: ToolDef[] = [
  {
    name: "browser",
    description: `Control a real web browser (Chromium/Chrome) on the user's machine — requires user permission. Perform ONE action per call.
Workflow: action=open (url) → read the returned 'elements' list (each has a numeric ref) → click/type using ref → the result contains a fresh snapshot + screenshot. 
Actions: open{url} | snapshot | click{ref|selector|text} | type{ref|selector, text, submit?, clear?} | press{key e.g. "Enter","Control+A"} | select{ref, value} | hover{ref} | scroll{direction:"down|up", amount?} | back | forward | wait{ms|selector} | get_text{selector?} | eval{script} | screenshot{fullPage?} | download{url | ref} (saves into workspace/downloads) | upload{ref, path} | tabs | switch_tab{index} | new_tab{url?} | close.
Fill forms field by field with type; use press Enter or type submit=true to submit. Re-snapshot after page changes because refs change.`,
    category: "browser",
    parameters: obj(
      {
        action: { type: "string", enum: ["open", "snapshot", "click", "type", "press", "select", "hover", "scroll", "back", "forward", "wait", "get_text", "eval", "screenshot", "download", "upload", "tabs", "switch_tab", "new_tab", "close"] },
        url: str("URL for open/new_tab/download"),
        ref: num("element ref from the last snapshot"),
        selector: str("CSS/Playwright selector"),
        text: str("text to type, or visible text to click"),
        key: str("key for press"),
        value: str("option value for select"),
        submit: bool("press Enter after typing"),
        clear: bool("clear the field before typing (default true)"),
        direction: str("down|up"),
        amount: num("scroll pixels (default 700)"),
        ms: num("wait milliseconds"),
        script: str("JavaScript expression for eval"),
        fullPage: bool("full page screenshot"),
        path: str("file path for upload"),
        index: num("tab index"),
      },
      ["action"],
    ),
    async run(a, ctx) {
      if (a.action === "close") {
        await closeBrowser();
        return { closed: true };
      }
      const st = await ensure(ctx);
      const page = () => st.page;
      const after = async (extra: Record<string, unknown> = {}) => {
        await settle(page());
        const snap = await snapshot(page());
        const screenshot = await shot(page(), ctx);
        return { ...extra, ...snap, screenshot };
      };
      switch (a.action) {
        case "open": {
          let url = String(a.url || "");
          if (!/^[a-z]+:/i.test(url)) url = "https://" + url;
          await page().goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
          return after({ opened: url });
        }
        case "new_tab": {
          const p = await st.context.newPage();
          st.page = p;
          if (a.url) await p.goto(/^[a-z]+:/i.test(a.url) ? a.url : "https://" + a.url, { waitUntil: "domcontentloaded", timeout: 45000 });
          return after({ tab: st.context.pages().length });
        }
        case "snapshot":
          return after();
        case "click": {
          const l = locate(page(), a);
          const before = st.downloads.length;
          await l.click({ timeout: 10000 });
          await page().waitForTimeout(500);
          return after({ clicked: true, newDownloads: st.downloads.slice(before) });
        }
        case "hover":
          await locate(page(), a).hover({ timeout: 10000 });
          return after({ hovered: true });
        case "type": {
          const l = locate(page(), a);
          if (a.clear === false) await l.pressSequentially(String(a.text ?? ""), { delay: 15 });
          else await l.fill(String(a.text ?? ""), { timeout: 10000 });
          if (a.submit) await l.press("Enter");
          return after({ typed: true });
        }
        case "press":
          await page().keyboard.press(String(a.key || "Enter"));
          return after({ pressed: a.key });
        case "select":
          await locate(page(), a).selectOption(String(a.value), { timeout: 10000 });
          return after({ selected: a.value });
        case "scroll":
          await page().mouse.wheel(0, (a.direction === "up" ? -1 : 1) * Number(a.amount || 700));
          await page().waitForTimeout(400);
          return after();
        case "back":
          await page().goBack({ timeout: 15000 }).catch(() => {});
          return after();
        case "forward":
          await page().goForward({ timeout: 15000 }).catch(() => {});
          return after();
        case "wait":
          if (a.selector) await page().waitForSelector(String(a.selector), { timeout: Number(a.ms || 15000) });
          else await page().waitForTimeout(Math.min(Number(a.ms || 1000), 30000));
          return after();
        case "get_text": {
          const t = a.selector ? await page().locator(String(a.selector)).first().innerText({ timeout: 10000 }) : await page().evaluate("document.body.innerText");
          return { url: page().url(), text: String(t).slice(0, 15000) };
        }
        case "eval": {
          const r = await page().evaluate(String(a.script));
          return { result: JSON.stringify(r)?.slice(0, 10000) };
        }
        case "screenshot": {
          const f = await shot(page(), ctx, !!a.fullPage);
          return { screenshot: f, url: page().url() };
        }
        case "download": {
          const dlDir = path.join(await ensureWorkspace(), "downloads");
          await fs.mkdir(dlDir, { recursive: true });
          if (a.url) {
            const r = await st.context.request.get(String(a.url), { timeout: 120000 });
            if (!r.ok()) throw new Error(`دانلود ناموفق: ${r.status()}`);
            const name = decodeURIComponent(path.basename(new URL(String(a.url)).pathname)) || `download-${Date.now()}`;
            const file = path.join(dlDir, name);
            await fs.writeFile(file, await r.body());
            await ctx.fileCreated(file);
            return { downloaded: file };
          }
          const [d] = await Promise.all([page().waitForEvent("download", { timeout: 60000 }), locate(page(), a).click({ timeout: 10000 })]);
          const file = path.join(dlDir, d.suggestedFilename());
          await d.saveAs(file);
          await ctx.fileCreated(file);
          return { downloaded: file };
        }
        case "upload": {
          const abs = await resolveSafe(String(a.path));
          await locate(page(), a).setInputFiles(abs);
          return after({ uploaded: abs });
        }
        case "tabs":
          return { tabs: await Promise.all(st.context.pages().map(async (p, i) => ({ index: i, url: p.url(), title: await p.title().catch(() => ""), active: p === st.page }))) };
        case "switch_tab": {
          const p = st.context.pages()[Number(a.index)];
          if (!p) throw new Error("تب پیدا نشد.");
          st.page = p;
          await p.bringToFront();
          return after();
        }
        default:
          throw new Error(`عمل ناشناخته: ${a.action}`);
      }
    },
  },
];
