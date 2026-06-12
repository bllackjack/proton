import { describe, expect, it } from "vitest";
import { carriesOver } from "./index";

describe("carriesOver", () => {
  it("carries partial and blocked tasks to the next day", () => {
    expect(carriesOver("partial")).toBe(true);
    expect(carriesOver("blocked")).toBe(true);
  });

  it("does not carry done or dropped tasks", () => {
    expect(carriesOver("done")).toBe(false);
    expect(carriesOver("dropped")).toBe(false);
  });
});
