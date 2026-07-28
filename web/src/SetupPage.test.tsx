// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readSetupStatus,
  SetupPage,
  type SetupStatus,
} from "./SetupPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("setup status client", () => {
  it("accepts only the exact bounded same-origin response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({
        state: "preparing",
        message: "SecretSauce is preparing this installation.",
        retry_pending: true,
      }),
    );
    await expect(readSetupStatus()).resolves.toEqual({
      state: "preparing",
      message: "SecretSauce is preparing this installation.",
      retry_pending: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/setup/status", {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json" },
    });

    for (const invalid of [
      { state: "ready", message: "unsafe", retry_pending: false },
      {
        state: "available",
        message: "SecretSauce is available.",
        retry_pending: false,
        internal_path: "/private/example",
      },
      {
        state: "not_ready",
        message: "",
        retry_pending: false,
      },
    ]) {
      fetchMock.mockResolvedValueOnce(response(invalid));
      await expect(readSetupStatus()).rejects.toThrow(
        "setup status unavailable",
      );
    }
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(2_049), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await expect(readSetupStatus()).rejects.toThrow("setup status unavailable");
  });
});

describe("setup page", () => {
  it("polls with capped backoff, announces change, and preserves focus", async () => {
    const statuses: SetupStatus[] = [
      preparing(true),
      preparing(true),
      preparing(true),
      preparing(true),
      preparing(true),
      {
        state: "enrollment",
        message: "SecretSauce is ready for secure enrollment.",
        retry_pending: false,
      },
    ];
    const readStatus = vi.fn(async () => statuses.shift()!);
    const callbacks: Array<() => void> = [];
    const delays: number[] = [];
    render(
      <SetupPage
        readStatus={readStatus}
        schedule={(callback, delay) => {
          callbacks.push(callback);
          delays.push(delay);
          return callbacks.length;
        }}
        cancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", {
      level: 1,
      name: "Setting up SecretSauce",
    })).toBeInTheDocument();
    const refresh = screen.getByRole("link", { name: "Refresh status" });
    refresh.focus();
    await waitFor(() => expect(callbacks).toHaveLength(1));
    for (let index = 0; index < 5; index += 1) {
      callbacks.shift()!();
      await waitFor(() => {
        if (index < 4) expect(callbacks).toHaveLength(1);
        else expect(screen.getByRole("link", {
          name: "Continue to secure enrollment",
        })).toHaveAttribute("href", "/control/enroll");
      });
    }
    expect(delays.slice(0, 3)).toEqual([1_000, 2_000, 5_000]);
    expect(delays.slice(3).every((delay) => delay === 5_000)).toBe(true);
    expect(delays.length).toBeLessThanOrEqual(6);
    expect(refresh).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "SecretSauce is ready for secure enrollment.",
    );
  });

  it("fails closed, retries on demand, and redirects only on available", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const readStatus = vi.fn()
      .mockRejectedValueOnce(new Error("private detail"))
      .mockResolvedValueOnce({
        state: "available",
        message: "SecretSauce is available.",
        retry_pending: false,
      });
    render(
      <SetupPage
        readStatus={readStatus}
        navigate={navigate}
        schedule={vi.fn(() => 1)}
        cancel={vi.fn()}
      />,
    );
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getAllByText(
      "SecretSauce needs operator attention before setup can continue.",
    )).toHaveLength(2);
    expect(document.body.textContent).not.toContain("private detail");
    expect(navigate).not.toHaveBeenCalled();

    retry.focus();
    await user.click(retry);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/control/");
    });
  });
});

function preparing(retryPending: boolean): SetupStatus {
  return {
    state: "preparing",
    message: "SecretSauce is preparing this installation.",
    retry_pending: retryPending,
  };
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
