import { spawn } from "node:child_process";
import { resolveSafe } from "@/lib/paths";
import { bool, num, obj, str, type ToolDef } from "./types";

function runGit(args: string[], cwd: string, signal?: AbortSignal): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, env: process.env, shell: false });
    let stdout = "";
    let stderr = "";
    const addOut = (b: Buffer) => {
      if (stdout.length < 40000) stdout += b.toString();
    };
    const addErr = (b: Buffer) => {
      if (stderr.length < 10000) stderr += b.toString();
    };
    child.stdout.on("data", addOut);
    child.stderr.on("data", addErr);
    const timer = setTimeout(() => child.kill("SIGKILL"), 30000);
    const onAbort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", onAbort);
    child.on("error", (e) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve({ code: -1, stdout, stderr: stderr + "\n" + e.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve({ code, stdout, stderr });
    });
  });
}

export const gitTools: ToolDef[] = [
  {
    name: "git_status",
    description: "Inspect the Git repository status (branch, modified/untracked/staged files) inside a workspace directory.",
    category: null,
    parameters: obj({ path: str("repository path relative to workspace, default '.'") }),
    async run(a, ctx) {
      const cwd = await resolveSafe(a.path || ".");
      const [status, branch] = await Promise.all([
        runGit(["status", "--short", "--branch"], cwd, ctx.signal),
        runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd, ctx.signal),
      ]);
      if (status.code !== 0) {
        throw new Error(status.stderr.trim() || "این پوشه یک مخزن Git معتبر نیست.");
      }
      return {
        directory: cwd,
        branch: branch.stdout.trim(),
        status: status.stdout.trim() || "مخزن تمیز است (تغییری وجود ندارد).",
      };
    },
  },
  {
    name: "git_diff",
    description: "Show Git code changes (diff) for code review, bug hunting, or generating commit messages. Supports staged changes, unstaged changes, or diff against a commit/branch.",
    category: null,
    parameters: obj({
      path: str("repository directory relative to workspace, default '.'"),
      staged: bool("if true, show staged changes (--cached)"),
      file: str("optional specific file path to diff"),
      target: str("optional commit hash or branch name to diff against (e.g. HEAD~1 or main)"),
    }),
    async run(a, ctx) {
      const cwd = await resolveSafe(a.path || ".");
      const args = ["diff"];
      if (a.staged) args.push("--cached");
      if (a.target) args.push(String(a.target));
      if (a.file) args.push("--", String(a.file));
      const res = await runGit(args, cwd, ctx.signal);
      if (res.code !== 0) {
        throw new Error(res.stderr.trim() || "خطا در اجرای git diff.");
      }
      return {
        directory: cwd,
        diff: res.stdout.trim() ? res.stdout.slice(0, 20000) : "تغییری برای نمایش وجود ندارد.",
        truncated: res.stdout.length > 20000,
      };
    },
  },
  {
    name: "git_log",
    description: "View recent Git commit history for a repository or a specific file.",
    category: null,
    parameters: obj({
      path: str("repository directory relative to workspace, default '.'"),
      limit: num("number of commits to show (default 15, max 50)"),
      stat: bool("include changed file statistics"),
      file: str("optional file path to filter commit history"),
    }),
    async run(a, ctx) {
      const cwd = await resolveSafe(a.path || ".");
      const limit = Math.min(Math.max(Number(a.limit || 15), 1), 50);
      const args = ["log", `-n`, String(limit), "--pretty=format:%h | %ad | %an | %s", "--date=short"];
      if (a.stat) args.push("--stat");
      if (a.file) args.push("--", String(a.file));
      const res = await runGit(args, cwd, ctx.signal);
      if (res.code !== 0) {
        throw new Error(res.stderr.trim() || "خطا در خواندن تاریخچه Git.");
      }
      return {
        directory: cwd,
        commits: res.stdout.trim() || "کامیتی ثبت نشده است.",
      };
    },
  },
  {
    name: "git_commit",
    description: "Stage files and create a local Git commit (requires user approval). Does NOT push to remote.",
    category: "code",
    parameters: obj(
      {
        path: str("repository directory relative to workspace, default '.'"),
        message: str("commit message"),
        files: { type: "array", items: { type: "string" }, description: "list of file paths to stage; if omitted and stageAll=true, stages all changes" },
        stageAll: bool("if true, stage all modified and untracked files (git add -A)"),
      },
      ["message"],
    ),
    async run(a, ctx) {
      const cwd = await resolveSafe(a.path || ".");
      const msg = String(a.message || "").trim();
      if (!msg) throw new Error("پیام کامیت نمی‌تواند خالی باشد.");

      if (Array.isArray(a.files) && a.files.length > 0) {
        const addRes = await runGit(["add", "--", ...a.files.map(String)], cwd, ctx.signal);
        if (addRes.code !== 0) throw new Error(addRes.stderr.trim() || "خطا در git add.");
      } else if (a.stageAll) {
        const addRes = await runGit(["add", "-A"], cwd, ctx.signal);
        if (addRes.code !== 0) throw new Error(addRes.stderr.trim() || "خطا در git add -A.");
      }

      const commitRes = await runGit(["commit", "-m", msg], cwd, ctx.signal);
      if (commitRes.code !== 0) {
        throw new Error((commitRes.stderr || commitRes.stdout).trim() || "خطا در ثبت کامیت.");
      }
      return {
        ok: true,
        directory: cwd,
        output: commitRes.stdout.trim(),
      };
    },
  },
];
