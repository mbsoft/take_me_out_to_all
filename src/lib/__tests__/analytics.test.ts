import { describe, it, expect } from "vitest";
import { scrubUrl } from "../analytics";

describe("scrubUrl", () => {
  it("drops query strings, so emails and tokens never leave the browser", () => {
    expect(scrubUrl("https://takemeout.mbsoft.com/verify-email?email=a%40b.com")).toBe("https://takemeout.mbsoft.com/verify-email");
    expect(scrubUrl("https://takemeout.mbsoft.com/reset-password?token=abc123#x")).toBe("https://takemeout.mbsoft.com/reset-password");
  });

  it("hides share tokens", () => {
    expect(scrubUrl("https://takemeout.mbsoft.com/share/uE-ieUgtjZWJ")).toBe("https://takemeout.mbsoft.com/share/:token");
    expect(scrubUrl("/share/uE-ieUgtjZWJ?x=1")).toBe("/share/:token");
  });

  it("leaves other URLs and non-strings alone", () => {
    expect(scrubUrl("https://takemeout.mbsoft.com/dashboard")).toBe("https://takemeout.mbsoft.com/dashboard");
    expect(scrubUrl(null)).toBe(null);
    expect(scrubUrl(42)).toBe(42);
  });
});
