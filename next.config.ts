import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  serverExternalPackages: [
    "pdfkit",
    "fontkit",
    "pdf-parse",
    "pdf-lib",
    "playwright-core",
    "pptxgenjs",
    "docx",
    "mammoth",
    "jszip",
    "@xmldom/xmldom",
    "@modelcontextprotocol/sdk",
    "pg",
    "cron-parser",
  ],
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/vendor/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
