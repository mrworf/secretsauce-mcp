// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync, readdirSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTROL_NAVIGATION,
  navigationForRole,
  type HumanControlRole,
} from "./navigation";
import {
  createTestControlRouter,
  implementedControlPaths,
} from "./router";

const ROLES: readonly HumanControlRole[] = ["user", "admin", "superadmin"];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("release accessibility and route completeness", () => {
  it("maps every navigation entry to exactly one implemented workspace", () => {
    expect([...implementedControlPaths()].sort())
      .toEqual(CONTROL_NAVIGATION.map(({ path }) => path).sort());
    expect(new Set(implementedControlPaths()).size).toBe(CONTROL_NAVIGATION.length);
  });

  for (const role of ROLES) {
    it(`renders every ${role} route with one page heading, unique ids, and named controls`, () => {
      vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
      for (const item of navigationForRole(role)) {
        const view = render(
          <RouterProvider router={createTestControlRouter(role, item.path)} />,
        );
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(item.label);
        expect(screen.queryByText("We could not open this page")).not.toBeInTheDocument();

        const ids = Array.from(view.container.querySelectorAll<HTMLElement>("[id]"))
          .map(({ id }) => id);
        expect(new Set(ids).size).toBe(ids.length);

        const interactive = view.container.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea, summary",
        );
        for (const element of interactive) {
          expect(hasAccessibleName(element), `${role} ${item.path}: ${element.outerHTML}`)
            .not.toBe("");
        }
        expect(view.container.querySelector("[tabindex]:not([tabindex='-1'])")).toBeNull();
        view.unmount();
      }
    });
  }

  it("renders only public branding text and alternative text in source routes", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const view = render(
      <RouterProvider router={createTestControlRouter("superadmin", "/openapi")} />,
    );
    expect(screen.getByRole("img", { name: "SecretSauce" })).toBeInTheDocument();
    expect(screen.getAllByText("SecretSauce").length).toBeGreaterThan(0);
    expect(view.container.textContent).not.toMatch(
      /(?:gref_|sec_|authorization\s*:|bearer\s+|cookie\s*:|\/home\/|\/private\/)/i,
    );
  });

  it("ships the product name and branded image in the production bundle", () => {
    const root = new URL("../../dist/control-web/", import.meta.url);
    const html = readFileSync(new URL("index.html", root), "utf8");
    const assets = readdirSync(new URL("assets/", root));
    const scriptName = assets.find((name) => /^index-.*\.js$/.test(name));
    expect(html).toContain("<title>SecretSauce Control</title>");
    expect(assets.some((name) => /^secretsauce-lockup-.*\.png$/.test(name))).toBe(true);
    expect(scriptName).toBeDefined();
    expect(readFileSync(new URL(`assets/${scriptName}`, root), "utf8"))
      .toContain("SecretSauce");
  });
});

function hasAccessibleName(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    if (text) return text;
  }
  if (element instanceof HTMLInputElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLTextAreaElement) {
    const label = element.labels?.[0]?.textContent?.trim();
    if (label) return label;
    return element.getAttribute("title")?.trim() ?? "";
  }
  return element.textContent?.trim() ?? element.getAttribute("title")?.trim() ?? "";
}
