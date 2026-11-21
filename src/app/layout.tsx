import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "رایمند | دستیار هوش مصنوعی همه‌کاره",
  description: "رایمند: چت هوشمند، عامل خودکار، مقایسه مدل‌ها، رابط تعاملی، ساخت اسناد PDF/Word/PowerPoint/Excel، کنترل مرورگر و MCP",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const initScript = `try{var t=localStorage.getItem('rm-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');var l=localStorage.getItem('rm-lang');if(l==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr'}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
