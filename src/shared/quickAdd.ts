import type { Priority, QuickTaskDraft } from "./types.js";
import { addChinaDays, formatDate, parseWeekdayToken, type RepeatRule } from "./dateRules.js";

const priorityTokens: Record<string, Priority> = {
  "!高": 3,
  "!中": 2,
  "!低": 1,
  "!无": 0,
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3
};

const repeatTokens: Record<string, RepeatRule> = {
  每天: "daily",
  每日: "daily",
  daily: "daily",
  every_day: "daily",
  每周: "weekly",
  每星期: "weekly",
  weekly: "weekly",
  每月: "monthly",
  monthly: "monthly"
};

export function parseQuickTask(input: string, baseDate = new Date()): QuickTaskDraft {
  let working = input.trim().replace(/\s+/g, " ");
  const tags = Array.from(working.matchAll(/(^|\s)#([^\s#]+)/g)).map((match) => match[2]);
  working = working.replace(/(^|\s)#[^\s#]+/g, " ");

  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let repeatRule: RepeatRule | null = null;
  const dateRules: Array<[RegExp, number]> = [
    [/(^|\s)(今天|today)(?=\s|$)/i, 0],
    [/(^|\s)(明天|tomorrow)(?=\s|$)/i, 1],
    [/(^|\s)(后天)(?=\s|$)/i, 2]
  ];

  for (const [pattern, offset] of dateRules) {
    if (pattern.test(working)) {
      dueDate = formatDate(addChinaDays(baseDate, offset));
      working = working.replace(pattern, " ");
      break;
    }
  }

  const absoluteDate = working.match(/(^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/);
  if (absoluteDate) {
    dueDate = absoluteDate[2];
    working = working.replace(absoluteDate[0], " ");
  }

  const weekday = working.match(/(^|\s)((?:下)?(?:周|星期|礼拜)[日天一二三四五六])(?=\s|$)/);
  if (weekday) {
    dueDate = parseWeekdayToken(weekday[2], baseDate);
    working = working.replace(weekday[0], " ");
  }

  const time = working.match(/(^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/);
  if (time) {
    dueTime = `${time[2].padStart(2, "0")}:${time[3]}`;
    working = working.replace(time[0], " ");
  }

  let priority: Priority = 0;
  for (const [token, value] of Object.entries(priorityTokens)) {
    const pattern = new RegExp(`(^|\\s)${token.replace("!", "\\!")}(?=\\s|$)`, "i");
    if (pattern.test(working)) {
      priority = value;
      working = working.replace(pattern, " ");
      break;
    }
  }

  for (const [token, value] of Object.entries(repeatTokens)) {
    const pattern = new RegExp(`(^|\\s)${token}(?=\\s|$)`, "i");
    if (pattern.test(working)) {
      repeatRule = value;
      working = working.replace(pattern, " ");
      break;
    }
  }

  return {
    title: working.trim().replace(/\s+/g, " ") || input.trim(),
    dueDate,
    dueTime,
    priority,
    tags,
    repeatRule
  };
}
