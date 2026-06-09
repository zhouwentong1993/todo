import { describe, expect, it } from "vitest";
import { parseQuickTask } from "../src/shared/quickAdd";

describe("parseQuickTask", () => {
  it("extracts title, due date, priority, and tags from a natural quick-add line", () => {
    const base = new Date("2026-06-10T09:00:00+08:00");

    const result = parseQuickTask("今天 18:30 完成产品方案 #工作 !高", base);

    expect(result.title).toBe("完成产品方案");
    expect(result.dueDate).toBe("2026-06-10");
    expect(result.dueTime).toBe("18:30");
    expect(result.priority).toBe(3);
    expect(result.tags).toEqual(["工作"]);
  });

  it("supports tomorrow and low priority without leaving command tokens in the title", () => {
    const base = new Date("2026-06-10T09:00:00+08:00");

    const result = parseQuickTask("明天 买牛奶 p1 #生活", base);

    expect(result.title).toBe("买牛奶");
    expect(result.dueDate).toBe("2026-06-11");
    expect(result.priority).toBe(1);
    expect(result.tags).toEqual(["生活"]);
  });

  it("understands weekday dates and recurring daily tasks", () => {
    const base = new Date("2026-06-10T09:00:00+08:00");

    const result = parseQuickTask("周五 每天 08:00 晨间复盘 #习惯", base);

    expect(result.title).toBe("晨间复盘");
    expect(result.dueDate).toBe("2026-06-12");
    expect(result.dueTime).toBe("08:00");
    expect(result.repeatRule).toBe("daily");
    expect(result.tags).toEqual(["习惯"]);
  });

  it("understands next-week dates and recurring weekly tasks", () => {
    const base = new Date("2026-06-10T09:00:00+08:00");

    const result = parseQuickTask("下周一 每周 例会准备 !中", base);

    expect(result.title).toBe("例会准备");
    expect(result.dueDate).toBe("2026-06-15");
    expect(result.repeatRule).toBe("weekly");
    expect(result.priority).toBe(2);
  });
});
