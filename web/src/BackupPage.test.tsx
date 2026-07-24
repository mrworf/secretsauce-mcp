// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
  BackupPage,
} from "./BackupPage";
import {
  ControlApiError,
  type BackupControlApi,
} from "./controlApi";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("portable backup workspace", () => {
  it("defaults to credential-less export and revokes the direct download URL", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const createObjectURL = vi.fn(() => "blob:portable-backup");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<BackupPage role="superadmin" api={api} />);

    expect(screen.getByRole("radio", { name: /Portable configuration only/ }))
      .toBeChecked();
    expect(screen.queryByLabelText("Backup passphrase")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", {
      name: BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
    }));
    await user.type(screen.getByLabelText("Current password"), "not-retained");
    await user.type(screen.getByLabelText("Current 6-digit TOTP"), "123456");
    await user.click(screen.getByRole("button", {
      name: "Create and download backup",
    }));

    await waitFor(() => expect(api.createPortableBackup).toHaveBeenCalledWith({
      include_secrets: false,
      acknowledgement: BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      password: "not-retained",
      totp: "123456",
    }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:portable-backup");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Portable backup downloaded.",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("Current 6-digit TOTP")).toHaveValue("");
    expect(screen.getByRole("checkbox", {
      name: BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
    })).toBeChecked();
    expect(document.body.textContent).not.toContain("not-retained");
  });

  it("clears every secret after failure while preserving mode and acknowledgement", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.createPortableBackup.mockRejectedValueOnce(
      new ControlApiError("vault_unavailable", "Backup generation is unavailable."),
    );
    render(<BackupPage role="superadmin" api={api} />);

    await user.click(screen.getByRole("radio", {
      name: /Include encrypted credential values/,
    }));
    await user.type(screen.getByLabelText("Backup passphrase"), "separate-passphrase");
    await user.type(
      screen.getByLabelText("Confirm backup passphrase"),
      "separate-passphrase",
    );
    await user.click(screen.getByRole("checkbox", {
      name: BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
    }));
    await user.type(screen.getByLabelText("Current password"), "not-retained");
    await user.type(screen.getByLabelText("Current 6-digit TOTP"), "123456");
    await user.click(screen.getByRole("button", {
      name: "Create and download backup",
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backup generation is unavailable.",
    );
    expect(screen.getByRole("radio", {
      name: /Include encrypted credential values/,
    })).toBeChecked();
    expect(screen.getByRole("checkbox", {
      name: BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
    })).toBeChecked();
    expect(screen.getByLabelText("Backup passphrase")).toHaveValue("");
    expect(screen.getByLabelText("Confirm backup passphrase")).toHaveValue("");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("Current 6-digit TOTP")).toHaveValue("");
    expect(document.body.textContent).not.toContain("separate-passphrase");
    expect(document.body.textContent).not.toContain("not-retained");
  });

  it("rejects mismatched and oversized UTF-8 passphrases before API work", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<BackupPage role="superadmin" api={api} />);
    await user.click(screen.getByRole("radio", {
      name: /Include encrypted credential values/,
    }));
    await user.click(screen.getByRole("checkbox", {
      name: BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
    }));
    await user.type(screen.getByLabelText("Current password"), "not-retained");
    await user.type(screen.getByLabelText("Current 6-digit TOTP"), "123456");
    await user.type(screen.getByLabelText("Backup passphrase"), "correct-length-value");
    await user.type(screen.getByLabelText("Confirm backup passphrase"), "does-not-match");
    expect(screen.getByText("Passphrases do not match.")).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "Create and download backup",
    })).toBeDisabled();

    await user.clear(screen.getByLabelText("Backup passphrase"));
    await user.type(screen.getByLabelText("Backup passphrase"), "é".repeat(513));
    expect(screen.getByText("Passphrase must contain 12–1,024 UTF-8 bytes."))
      .toBeInTheDocument();
    expect(api.createPortableBackup).not.toHaveBeenCalled();
  });

  it("does not expose backup controls to a non-superadmin", () => {
    const api = fakeApi();
    render(<BackupPage role="admin" api={api} />);
    expect(screen.getByRole("heading", { name: "Backup access is restricted" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "Create and download backup",
    })).not.toBeInTheDocument();
  });
});

type FakeBackupApi = {
  [K in keyof BackupControlApi]: ReturnType<typeof vi.fn<BackupControlApi[K]>>;
};

function fakeApi(): FakeBackupApi {
  return {
    createPortableBackup: vi.fn(async () =>
      new Blob(["portable archive"], { type: "application/gzip" })),
  };
}
