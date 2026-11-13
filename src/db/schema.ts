import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  uuid,
  real,
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  preset: text("preset").notNull().default("custom"),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull().default(""),
  model: text("model").notNull().default(""),
  models: jsonb("models").$type<string[]>().notNull().default([]),
  temperature: real("temperature").notNull().default(0.7),
  topP: real("top_p"),
  maxTokens: integer("max_tokens"),
  extraHeaders: jsonb("extra_headers").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  folder: text("folder").notNull().default(""),
  color: text("color").notNull().default("#6d5efc"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull().default("گفتگوی جدید"),
  projectId: integer("project_id"),
  providerId: integer("provider_id"),
  model: text("model").notNull().default(""),
  mode: text("mode").notNull().default("chat"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
  role: text("role").notNull(),
  parts: jsonb("parts").$type<unknown[]>().notNull().default([]),
  llm: jsonb("llm").$type<unknown[]>().notNull().default([]),
  status: text("status").notNull().default("done"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  source: text("source").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mcpServers = pgTable("mcp_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  preset: text("preset").notNull().default("custom"),
  transport: text("transport").notNull().default("stdio"),
  command: text("command").notNull().default(""),
  args: jsonb("args").$type<string[]>().notNull().default([]),
  env: jsonb("env").$type<Record<string, string>>().notNull().default({}),
  url: text("url").notNull().default(""),
  headers: jsonb("headers").$type<Record<string, string>>().notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  permission: text("permission").notNull().default("ask"),
  disabledTools: jsonb("disabled_tools").$type<string[]>().notNull().default([]),
  toolsCache: jsonb("tools_cache")
    .$type<{ name: string; description: string; inputSchema: unknown }[]>()
    .notNull()
    .default([]),
  status: text("status").notNull().default("unknown"),
  lastError: text("last_error").notNull().default(""),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  kind: text("kind").notNull().default("cron"),
  cron: text("cron").notNull().default(""),
  runAt: timestamp("run_at"),
  timezone: text("timezone").notNull().default("Asia/Tehran"),
  mode: text("mode").notNull().default("agent"),
  providerId: integer("provider_id"),
  model: text("model").notNull().default(""),
  projectId: integer("project_id"),
  enabled: boolean("enabled").notNull().default(true),
  autoApprove: boolean("auto_approve").notNull().default(false),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scheduleRuns = pgTable("schedule_runs", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  result: text("result").notNull().default(""),
  error: text("error").notNull().default(""),
  conversationId: uuid("conversation_id"),
});

export const artifacts = pgTable("artifacts", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("file"),
  conversationId: uuid("conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
