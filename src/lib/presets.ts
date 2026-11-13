export type ProviderPreset = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  needsKey: boolean;
  hint?: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o", needsKey: true },
  { id: "anthropic", name: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5", needsKey: true },
  { id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", needsKey: true },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o", needsKey: true, hint: "دسترسی به صدها مدل با یک کلید" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", needsKey: true },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", needsKey: true },
  { id: "mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-large-latest", needsKey: true },
  { id: "avalai", name: "آوالای (AvalAI)", baseUrl: "https://api.avalai.ir/v1", model: "gpt-4o", needsKey: true, hint: "درگاه ایرانی دسترسی به مدل‌ها" },
  { id: "ollama", name: "Ollama (محلی)", baseUrl: "http://localhost:11434/v1", model: "llama3.1", needsKey: false, hint: "مدل‌های محلی بدون نیاز به کلید" },
  { id: "lmstudio", name: "LM Studio (محلی)", baseUrl: "http://localhost:1234/v1", model: "local-model", needsKey: false },
  { id: "custom", name: "سفارشی (سازگار با OpenAI)", baseUrl: "", model: "", needsKey: true },
];

export type McpField = { key: string; label: string; secret?: boolean; placeholder?: string; optional?: boolean };

export type McpPreset = {
  id: string;
  name: string;
  description: string;
  repo: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  fields: McpField[];
  setup?: string;
  permission: "ask" | "allow";
};

export const MCP_PRESETS: McpPreset[] = [
  {
    id: "github",
    name: "GitHub MCP",
    description: "مدیریت مخازن، Issue ها، Pull Request ها، کد و Actions در GitHub (سرور رسمی ریموت).",
    repo: "https://github.com/github/github-mcp-server",
    transport: "http",
    url: "https://api.githubcopilot.com/mcp/",
    headers: { Authorization: "Bearer {token}" },
    fields: [{ key: "token", label: "GitHub Personal Access Token", secret: true, placeholder: "github_pat_..." }],
    permission: "ask",
  },
  {
    id: "github-docker",
    name: "GitHub MCP (محلی با Docker)",
    description: "اجرای محلی سرور رسمی GitHub با Docker (نیازمند نصب Docker).",
    repo: "https://github.com/github/github-mcp-server",
    transport: "stdio",
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "{token}" },
    fields: [{ key: "token", label: "GitHub Personal Access Token", secret: true }],
    permission: "ask",
  },
  {
    id: "bale",
    name: "Bale MCP (پیام‌رسان بله)",
    description: "ارسال و خواندن پیام، مدیریت گروه‌ها، مخاطبین و کانال‌ها در پیام‌رسان بله.",
    repo: "https://github.com/aminmadaniofficial/bale-mcp-server",
    transport: "stdio",
    command: "uv",
    args: ["--directory", "{dir}", "run", "bale-mcp", "run"],
    env: { BALE_SESSIONS_DIR: "{dir}/sessions" },
    fields: [{ key: "dir", label: "مسیر پوشهٔ bale-mcp-server روی سیستم شما", placeholder: "/home/me/bale-mcp-server" }],
    setup:
      "ابتدا نصب کنید:  git clone https://github.com/aminmadaniofficial/bale-mcp-server.git && cd bale-mcp-server && uv venv && uv pip install -e .  سپس با  bale-mcp login --phone 989XXXXXXXXX  وارد حساب بله شوید.",
    permission: "ask",
  },
  {
    id: "playwright",
    name: "Playwright MCP (مرورگر رسمی)",
    description: "کنترل کامل مرورگر با سرور رسمی Playwright MCP مایکروسافت (snapshot، کلیک، تایپ، دانلود و ...).",
    repo: "https://github.com/microsoft/playwright-mcp",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    fields: [],
    permission: "ask",
  },
];

export const CRON_PRESETS = [
  { label: "هر ۵ دقیقه", cron: "*/5 * * * *" },
  { label: "هر ساعت", cron: "0 * * * *" },
  { label: "هر روز ساعت ۹ صبح", cron: "0 9 * * *" },
  { label: "هر روز ساعت ۸ شب", cron: "0 20 * * *" },
  { label: "هر شنبه ساعت ۹", cron: "0 9 * * 6" },
  { label: "اول هر ماه", cron: "0 9 1 * *" },
];
