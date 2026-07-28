// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import type { BrowserAuthenticationApi, OidcControlApi } from "./controlApi";

type Api = Pick<BrowserAuthenticationApi, "login"> & OidcControlApi;

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/control/login");
});

describe("branded browser login", () => {
  it("submits all local factors together, clears secrets, and resumes a safe destination", async () => {
    window.history.replaceState({}, "", "/control/login?next=%2Fcontrol%2Fservices");
    const navigate = vi.fn();
    const api: Api = {
      login: vi.fn().mockResolvedValue({
        user_id: "018f1f2e-7b3c-7a10-8000-000000000001",
        role: "superadmin",
        csrf_token: "c".repeat(43),
        expires_at: 1_785_000_900_000,
        destination: "/control/services",
      }),
      oidcProviders: vi.fn().mockResolvedValue({ providers: [] }),
      beginOidc: vi.fn(),
    };
    render(<LoginPage api={api} navigate={navigate} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@example.org" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password-Value-2026" },
    });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    await waitFor(() => expect(api.login).toHaveBeenCalledWith({
      email: "admin@example.org",
      password: "Password-Value-2026",
      totp: "123456",
      destination: "/control/services",
    }));
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Authenticator code")).toHaveValue("");
    expect(navigate).toHaveBeenCalledWith("/control/services");
  });

  it("uses one failure for every rejected local factor and ignores an unsafe destination", async () => {
    window.history.replaceState({}, "", "/control/login?next=https%3A%2F%2Fevil.example.org");
    const api: Api = {
      login: vi.fn().mockRejectedValue(new Error("password valid but totp invalid")),
      oidcProviders: vi.fn().mockResolvedValue({ providers: [] }),
      beginOidc: vi.fn(),
    };
    render(<LoginPage api={api} navigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.org" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "000000" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in details are invalid.");
    expect(api.login).toHaveBeenCalledWith({
      email: "person@example.org",
      password: "wrong",
      totp: "000000",
    });
    expect(screen.queryByText(/password valid|totp invalid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot|remember me/i)).not.toBeInTheDocument();
  });

  it("shows only configured OIDC alternatives and the neutral enrollment entry", async () => {
    const navigate = vi.fn();
    const api: Api = {
      login: vi.fn(),
      oidcProviders: vi.fn().mockResolvedValue({
        providers: [{ id: "workforce", display_name: "Workforce identity" }],
      }),
      beginOidc: vi.fn().mockResolvedValue({
        authorization_url: "https://id.example.org/authorize?state=opaque",
        expires_at: 1_785_000_300_000,
      }),
    };
    render(<LoginPage api={api} navigate={navigate} />);
    const provider = await screen.findByRole("button", {
      name: "Continue with Workforce identity",
    });
    fireEvent.click(provider);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      "https://id.example.org/authorize?state=opaque",
    ));
    expect(screen.getByRole("link", { name: "Enroll account" }))
      .toHaveAttribute("href", "/control/enroll");
  });
});
