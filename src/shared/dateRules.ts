export type RepeatRule = "daily" | "weekly" | "monthly";

const weekdayMap: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6
};

export function chinaParts(date: Date) {
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

export function addChinaDays(base: Date, days: number) {
  const parts = chinaParts(base);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function parseDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

export function nextWeekday(baseDate: Date, weekday: number, forceNextWeek = false) {
  const base = addChinaDays(baseDate, 0);
  const current = base.getUTCDay();
  if (forceNextWeek) {
    const currentIso = current === 0 ? 7 : current;
    const targetIso = weekday === 0 ? 7 : weekday;
    const daysUntilNextMonday = currentIso === 1 ? 7 : 8 - currentIso;
    return formatDate(addChinaDays(baseDate, daysUntilNextMonday + targetIso - 1));
  }
  let offset = (weekday - current + 7) % 7;
  if (offset === 0) offset += 7;
  return formatDate(addChinaDays(baseDate, offset));
}

export function parseWeekdayToken(token: string, baseDate = new Date()) {
  const match = token.match(/^(下)?(?:周|星期|礼拜)([日天一二三四五六])$/);
  if (!match) return null;
  return nextWeekday(baseDate, weekdayMap[match[2]], Boolean(match[1]));
}

export function nextRepeatDate(dueDate: string, rule: RepeatRule) {
  const date = parseDateString(dueDate);
  if (rule === "daily") return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)));
  if (rule === "weekly") return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 7)));
  return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())));
}

export function isRepeatRule(value: unknown): value is RepeatRule {
  return value === "daily" || value === "weekly" || value === "monthly";
}
