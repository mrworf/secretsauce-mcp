// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnrollmentPage } from "./EnrollmentPage";
import type { EnrollmentControlApi } from "./controlApi";

afterEach(cleanup);

describe("unified browser enrollment", () => {
  it("completes the keyboard-accessible three-step ceremony and redirects to login", async () => {
    const navigate = vi.fn();
    const api: EnrollmentControlApi = {
      enrollmentLogin: vi.fn().mockResolvedValue({
        csrf_token: "a".repeat(43),
        expires_at: 1_785_000_900_000,
      }),
      beginEnrollment: vi.fn().mockResolvedValue({
        secret: "ABCDEFGHIJKLMNOPQRSTUVWX23456789",
        otpauth_uri: "otpauth://totp/SecretSauce%3Aadmin%40example.org?secret=ABC",
        csrf_token: "b".repeat(43),
        expires_at: 1_785_000_900_000,
      }),
      confirmEnrollment: vi.fn().mockResolvedValue({ enrolled: true }),
    };
    render(<EnrollmentPage api={api} navigate={navigate} />);

    expect(screen.getByRole("heading", { name: "Verify your enrollment" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Enrollment code"))
      .toHaveAttribute("autocomplete", "one-time-code");
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@example.org" },
    });
    fireEvent.change(screen.getByLabelText("Enrollment code"), {
      target: { value: "one-time-enrollment-value" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);

    expect(await screen.findByRole("heading", { name: "Choose a password" }))
      .toHaveFocus();
    expect(api.enrollmentLogin).toHaveBeenCalledWith({
      email: "admin@example.org",
      enrollment_code: "one-time-enrollment-value",
    });
    fireEvent.change(screen.getByLabelText("Given name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Family name"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "Permanent-Enrollment-Password-2026" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Permanent-Enrollment-Password-2026" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);

    expect(await screen.findByRole("heading", { name: "Set up an authenticator" }))
      .toHaveFocus();
    expect(screen.getByRole("img", {
      name: "QR code containing the sensitive authenticator setup",
    }).querySelector("svg")).not.toBeNull();
    expect(api.beginEnrollment).toHaveBeenCalledWith({
      csrf_token: "a".repeat(43),
      new_password: "Permanent-Enrollment-Password-2026",
      given_name: "Ada",
      family_name: "Lovelace",
    });
    expect(screen.getByLabelText("Manual authenticator key")).not
      .toHaveTextContent("ABCDEFGHIJKLMNOPQRSTUVWX23456789");
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(screen.getByLabelText("Manual authenticator key"))
      .toHaveTextContent("ABCDEFGHIJKLMNOPQRSTUVWX23456789");
    expect(screen.getByLabelText("6-digit code")).toHaveAttribute("inputmode", "numeric");
    fireEvent.change(screen.getByLabelText("6-digit code"), {
      target: { value: "123456" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Complete enrollment" }).closest("form")!,
    );

    await waitFor(() => expect(api.confirmEnrollment).toHaveBeenCalledWith({
      csrf_token: "b".repeat(43),
      new_password: "Permanent-Enrollment-Password-2026",
      totp: "123456",
    }));
    expect(navigate).toHaveBeenCalledWith("/control/login?enrollment=complete");
  });

  it("uses a neutral failure, clears the enrollment code, and discloses no cause", async () => {
    const api: EnrollmentControlApi = {
      enrollmentLogin: vi.fn().mockRejectedValue(
        new Error("bootstrap expired and user missing"),
      ),
      beginEnrollment: vi.fn(),
      confirmEnrollment: vi.fn(),
    };
    render(<EnrollmentPage api={api} navigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "unknown@example.org" },
    });
    const code = screen.getByLabelText("Enrollment code");
    fireEvent.change(code, { target: { value: "wrong-value" } });
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Enrollment details are invalid or expired. Try again.");
    expect(code).toHaveValue("");
    expect(screen.queryByText(/bootstrap|user missing/i)).not.toBeInTheDocument();
  });

  it("permits password-manager paste and keeps mismatched passwords local", async () => {
    const api: EnrollmentControlApi = {
      enrollmentLogin: vi.fn().mockResolvedValue({
        csrf_token: "c".repeat(43),
        expires_at: 1_785_000_900_000,
      }),
      beginEnrollment: vi.fn(),
      confirmEnrollment: vi.fn(),
    };
    render(<EnrollmentPage api={api} navigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.org" },
    });
    fireEvent.change(screen.getByLabelText("Enrollment code"), {
      target: { value: "temporary-value" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);
    await screen.findByRole("heading", { name: "Choose a password" });
    fireEvent.paste(screen.getByLabelText("New password"), {
      clipboardData: { getData: () => "Pasted-Password-Value-2026" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "Pasted-Password-Value-2026" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different-value" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(api.beginEnrollment).not.toHaveBeenCalled();
  });
});
