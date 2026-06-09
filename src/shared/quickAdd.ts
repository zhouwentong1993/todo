import type { Priority, QuickTaskDraft } from "./types.js";

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

function chinaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day"))
  };
}

function addChinaDays(base: Date, days: number) {
  const parts = chinaParts(base);
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0);
  return new Date(utc);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function parseQuickTask(input: string, baseDate = new Date()): QuickTaskDraft {
  let working = input.trim().replace(/\s+/g, " ");
  const tags = Array.from(working.matchAll(/(^|\s)#([^\s#]+)/g)).map((match) => match[2]);
  working = working.replace(/(^|\s)#[^\s#]+/g, " ");

  let dueDate: string | null = null;
  let dueTime: string | null = null;
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

  return {
    title: working.trim().replace(/\s+/g, " ") || input.trim(),
    dueDate,
    dueTime,
    priority,
    tags
  };
}
