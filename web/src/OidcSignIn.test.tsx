// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OidcSignIn } from "./OidcSignIn";
import type { OidcControlApi } from "./controlApi";

describe("external sign-in view", () => {
  it("lists safe provider labels and starts one same-origin begin operation", async () => {
    const navigate = vi.fn();
    const api: OidcControlApi = {
      oidcProviders: vi.fn().mockResolvedValue({
        providers: [{ id: "workforce", display_name: "Workforce identity" }],
      }),
      beginOidc: vi.fn().mockResolvedValue({
        authorization_url: "https://id.example.org/authorize?state=opaque",
        expires_at: 1_785_000_300_000,
      }),
    };
    render(<OidcSignIn api={api} navigate={navigate} />);
    const button = await screen.findByRole("button", {
      name: "Continue with Workforce identity",
    });
    fireEvent.click(button);
    await waitFor(() => expect(api.beginOidc).toHaveBeenCalledWith("workforce"));
    expect(navigate).toHaveBeenCalledWith("https://id.example.org/authorize?state=opaque");
  });

  it("shows one bounded unavailable state without provider details", async () => {
    const api: OidcControlApi = {
      oidcProviders: vi.fn().mockRejectedValue(new Error("token and endpoint detail")),
      beginOidc: vi.fn(),
    };
    render(<OidcSignIn api={api} navigate={vi.fn()} />);
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Sign-in options are temporarily unavailable.");
    expect(screen.queryByText(/token and endpoint detail/)).not.toBeInTheDocument();
  });
});
