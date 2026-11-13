"use client";

import { Code2, Copy, Download, ExternalLink, Maximize2, Minimize2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";

function themeVars() {
  const cs = getComputedStyle(document.documentElement);
  return ["bg", "panel", "panel2", "line", "fg", "muted", "brand", "brand2", "good", "bad", "warn"].map((k) => `--${k}:${cs.getPropertyValue(`--${k}`).trim()}`).join(";");
}

export function buildSrcDoc(html: string, id: string) {
  const origin = window.location.origin;
  const dark = document.documentElement.classList.contains("dark");
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">
<style>@font-face{font-family:"Vazirmatn";src:url("${origin}/fonts/Vazirmatn.woff2") format("woff2");font-weight:100 900}
:root{${themeVars()};color-scheme:${dark ? "dark" : "light"}}
*{box-sizing:border-box}
html{background:transparent}
body{margin:0;padding:16px;font-family:"Vazirmatn",Tahoma,sans-serif;color:var(--fg);direction:rtl;line-height:1.8}
button,input,select,textarea{font-family:inherit}
</style>
<script src="${origin}/vendor/chart.umd.js"></script>
<script>(function(){var ID=${JSON.stringify(id)};
function post(m){m.id=ID;parent.postMessage(m,"*")}
window.raymind={send:function(t){post({rm:"send",text:String(t)})},setHeight:function(h){post({rm:"height",h:h,fixed:true})}};
if(window.Chart){try{Chart.defaults.font.family="Vazirmatn, Tahoma";Chart.defaults.color=getComputedStyle(document.documentElement).getPropertyValue("--muted")}catch(e){}}
var last=0;function rep(){var h=Math.ceil(Math.max(document.body.scrollHeight,document.body.offsetHeight)+2);if(Math.abs(h-last)>3){last=h;post({rm:"height",h:h})}}
addEventListener("load",function(){rep();setTimeout(rep,400);setTimeout(rep,1200)});
try{new ResizeObserver(rep).observe(document.body)}catch(e){}
})();</script>`;
  if (/<html[\s>]/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + head);
    return html.replace(/<html[^>]*>/i, (m) => m + `<head>${head}</head>`);
  }
  return `<!doctype html><html dir="rtl" lang="fa"><head>${head}</head><body>${html}</body></html>`;
}

export function UIFrame({ id, title, html, onSend }: { id: string; title: string; html: string; onSend?: (t: string) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(320);
  const [full, setFull] = useState(false);
  const [code, setCode] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    const build = () => setSrcDoc(buildSrcDoc(html, id));
    build();
    window.addEventListener("rm:theme", build);
    return () => window.removeEventListener("rm:theme", build);
  }, [html, id, nonce]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.data || e.data.id !== id) return;
      if (e.data.rm === "height") setH(Math.min(Math.max(Number(e.data.h) || 200, 120), e.data.fixed ? 2000 : 1100));
      if (e.data.rm === "send" && onSend) onSend(String(e.data.text));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [id, onSend]);

  const copy = () => navigator.clipboard.writeText(html);
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buildSrcDoc(html, id)], { type: "text/html" }));
    a.download = `${title || "ui"}.html`;
    a.click();
  };
  const openTab = () => window.open(URL.createObjectURL(new Blob([buildSrcDoc(html, id)], { type: "text/html" })), "_blank");

  return (
    <div className={cx("rounded-2xl border border-line bg-panel overflow-hidden fade-in", full && "fixed inset-3 z-50 flex flex-col shadow-2xl")}>
      <div className="flex items-center justify-between px-3.5 py-2 bg-panel2/70 border-b border-line">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-brand" /> {title}
          <span className="text-[10px] text-muted font-normal border border-line rounded px-1.5">رابط تعاملی</span>
        </div>
        <div className="flex items-center gap-0.5 text-muted">
          {[
            { i: Code2, t: "کد", f: () => setCode(!code) },
            { i: RefreshCw, t: "بازنشانی", f: () => setNonce(nonce + 1) },
            { i: Copy, t: "کپی کد", f: copy },
            { i: Download, t: "دانلود HTML", f: download },
            { i: ExternalLink, t: "باز کردن در تب جدید", f: openTab },
            { i: full ? Minimize2 : Maximize2, t: "تمام‌صفحه", f: () => setFull(!full) },
          ].map(({ i: I, t, f }) => (
            <button key={t} title={t} onClick={f} className="p-1.5 rounded-lg hover:bg-panel hover:text-fg">
              <I size={15} />
            </button>
          ))}
        </div>
      </div>
      {code ? (
        <pre dir="ltr" className="text-xs p-4 overflow-auto max-h-[500px] bg-[#0f1220] text-slate-200 text-left">{html}</pre>
      ) : (
        <iframe
          ref={ref}
          title={title}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
          className="w-full block bg-transparent"
          style={{ height: full ? "100%" : h, flex: full ? 1 : undefined, border: 0 }}
        />
      )}
    </div>
  );
}
