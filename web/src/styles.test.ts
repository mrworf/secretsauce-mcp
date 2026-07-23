import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("responsive control shell styles", () => {
  it("declares the narrow, tablet, wide, dark, and reduced-motion contracts", () => {
    expect(styles).toContain("min-width: 320px");
    expect(styles).toMatch(/@media \(min-width: 768px\) and \(max-width: 1199px\)/);
    expect(styles).toMatch(/@media \(min-width: 1200px\)/);
    expect(styles).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("keeps target, focus, prose, and wide workspace boundaries explicit", () => {
    expect(styles).toMatch(/min-height: 44px/);
    expect(styles).toMatch(/min-width: 44px/);
    expect(styles).toMatch(/:focus-visible/);
    expect(styles).toMatch(/max-width: 80ch/);
    expect(styles).toMatch(/max-width: 1680px/);
    expect(styles).toMatch(/272px minmax\(0, 1fr\)/);
  });

  it("keeps the service workspace ordered on narrow screens and split only when wide", () => {
    expect(styles).toMatch(/\.service-layout \{[\s\S]*display: grid/);
    expect(styles).toMatch(/\.service-layout \{[\s\S]*min-width: 0/);
    expect(styles).toMatch(
      /@media \(min-width: 1200px\)[\s\S]*\.service-layout \{[\s\S]*grid-template-columns:/,
    );
    expect(styles).toMatch(/\.code-input \{[\s\S]*max-width: 100%/);
  });
});
