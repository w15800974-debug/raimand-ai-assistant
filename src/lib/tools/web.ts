import { obj, str, num, type ToolDef } from "./types";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&apos;": "'" };
const decode = (s: string) =>
  s
    .replace(/&(amp|lt|gt|quot|nbsp|apos|#39);/g, (m) => entities[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function htmlToText(html: string): { title: string; text: string } {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<a [^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => `${t} (${h})`)
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return {
    title,
    text: decode(text)
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim(),
  };
}

type Hit = { title: string; url: string; snippet: string };

async function ddg(q: string, limit: number): Promise<Hit[]> {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ q }).toString(),
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const out: Hit[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    let url = decode(m[1]);
    const u = url.match(/uddg=([^&]+)/);
    if (u) url = decodeURIComponent(u[1]);
    if (url.startsWith("//")) url = "https:" + url;
    out.push({ title: decode(m[2].replace(/<[^>]+>/g, "")).trim(), url, snippet: decode(m[3].replace(/<[^>]+>/g, "")).trim() });
  }
  return out;
}

export const webTools: ToolDef[] = [
  {
    name: "web_search",
    description: "Search the web for current information. Returns titles, URLs and snippets. Follow up with web_fetch to read a page.",
    category: "net",
    parameters: obj({ query: str("search query"), limit: num("max results, default 6") }, ["query"]),
    async run(a, ctx) {
      const limit = Math.min(Number(a.limit || 6), 15);
      const s = ctx.settings;
      let hits: Hit[] = [];
      if (s.searchProvider === "tavily" && s.tavilyKey) {
        const r = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.tavilyKey}` },
          body: JSON.stringify({ query: a.query, max_results: limit }),
          signal: AbortSignal.timeout(25000),
        });
        const j = await r.json();
        hits = (j.results || []).map((x: any) => ({ title: x.title, url: x.url, snippet: x.content }));
      } else if (s.searchProvider === "brave" && s.braveKey) {
        const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(a.query)}&count=${limit}`, {
          headers: { "X-Subscription-Token": s.braveKey, Accept: "application/json" },
          signal: AbortSignal.timeout(25000),
        });
        const j = await r.json();
        hits = (j.web?.results || []).map((x: any) => ({ title: x.title, url: x.url, snippet: decode(String(x.description || "").replace(/<[^>]+>/g, "")) }));
      } else if (s.searchProvider === "searxng" && s.searxUrl) {
        const r = await fetch(`${s.searxUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(a.query)}&format=json`, { signal: AbortSignal.timeout(25000) });
        const j = await r.json();
        hits = (j.results || []).slice(0, limit).map((x: any) => ({ title: x.title, url: x.url, snippet: x.content }));
      } else {
        hits = await ddg(a.query, limit);
      }
      if (!hits.length) return { results: [], note: "نتیجه‌ای پیدا نشد؛ عبارت جست‌وجو را تغییر دهید یا در تنظیمات یک سرویس جست‌وجو (Tavily/Brave) تنظیم کنید." };
      return { results: hits };
    },
  },
  {
    name: "web_fetch",
    description: "Fetch a web page or text/JSON URL and return readable text (HTML converted to text, links preserved).",
    category: "net",
    parameters: obj({ url: str("http(s) URL"), maxChars: num("default 12000") }, ["url"]),
    async run(a) {
      const res = await fetch(a.url, { headers: { "User-Agent": UA, "Accept-Language": "fa,en;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
      const ct = res.headers.get("content-type") || "";
      const body = await res.text();
      const max = Number(a.maxChars || 12000);
      if (ct.includes("html")) {
        const { title, text } = htmlToText(body);
        return { url: res.url, status: res.status, title, length: text.length, content: text.slice(0, max) };
      }
      return { url: res.url, status: res.status, contentType: ct, content: body.slice(0, max) };
    },
  },
];
