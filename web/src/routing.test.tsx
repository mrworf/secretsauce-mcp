// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createTestControlRouter } from "./router";
import { Link, MemoryRouter, useLocation } from "./routing";

afterEach(cleanup);

describe("control routing", () => {
  it("navigates an authorized application link without a document load", async () => {
    const user = userEvent.setup();
    render(createTestControlRouter("user"));

    await user.click(screen.getAllByRole("link", { name: "Services" })[0]!);

    expect(screen.getByRole("heading", { level: 1, name: "Services" })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 2, name: "Service drafts" }))
      .toBeInTheDocument();
  });

  it("rejects an unknown or role-forbidden browser path", () => {
    const view = render(createTestControlRouter("user", "/api-keys"));

    expect(screen.getByRole("heading", { level: 1, name: "API keys" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("We could not open this page");
    expect(view.container).not.toHaveTextContent("Create API key");
  });

  it("does not consume a link that targets a separate browsing context", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Link to="/services" target="_blank">Services</Link>
        <CurrentPath />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: "Services" }));

    expect(screen.getByTestId("current-path")).toHaveTextContent("/");
  });
});

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}
