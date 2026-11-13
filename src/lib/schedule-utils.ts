import { CronExpressionParser } from "cron-parser";

export function nextRun(cron: string, tz: string, from: Date = new Date()): Date | null {
  try {
    return CronExpressionParser.parse(cron, { currentDate: from, tz }).next().toDate();
  } catch {
    return null;
  }
}

export function validateCron(cron: string, tz: string): string | null {
  try {
    CronExpressionParser.parse(cron, { tz });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "عبارت cron نامعتبر است";
  }
}
