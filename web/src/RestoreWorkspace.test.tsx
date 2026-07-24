// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestoreWorkspace } from "./RestoreWorkspace";
import {
  ControlApiError,
  type RestoreControlApi,
  type RestorePreview,
  type RestoreStage,
} from "./controlApi";

const STAGE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000011";
const PREVIEW_ID = "018f1f2e-7b3c-7a10-8000-000000000012";
const PHRASE = `RESTORE ${ARCHIVE_ID}`;

beforeEach(() => {
  window.history.replaceState(null, "", "/control/backup");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("portable restore workspace", () => {
  it("completes upload, preview, high-friction commit, and signed-out result", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<RestoreWorkspace role="superadmin" api={api} />);

    expect(screen.getByText("Upload").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
    const file = new File(["portable archive"], "portable.tar.gz", {
      type: "application/gzip",
    });
    await user.upload(screen.getByLabelText("Portable restore archive"), file);
    await user.type(screen.getByLabelText("Current password"), "stage-secret");
    await user.type(screen.getByLabelText("Current 6-digit TOTP"), "123456");
    await user.click(screen.getByRole("button", { name: "Upload and validate" }));

    await waitFor(() => expect(api.stageRestore).toHaveBeenCalledWith({
      archive: file,
      password: "stage-secret",
      totp: "123456",
    }));
    expect(screen.getByRole("heading", { name: "Archive validated" }))
      .toBeInTheDocument();
    expect(screen.queryByLabelText("Portable restore archive"))
      .not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("stage-secret");
    expect(window.location.search).toContain(`restore_stage=${STAGE_ID}`);

    await user.type(
      screen.getByLabelText("Archive passphrase (optional)"),
      "archive-passphrase",
    );
    await user.click(screen.getByRole("button", { name: "Build restore preview" }));
    expect(await screen.findByRole("heading", {
      name: "Server-derived replacement preview",
    })).toBeInTheDocument();
    expect(api.previewRestore).toHaveBeenCalledWith({
      stageId: STAGE_ID,
      passphrase: "archive-passphrase",
    });
    expect(screen.getByRole("heading", { name: "Replaces" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preserves" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clears" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revokes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Remediates" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("archive-passphrase");

    const commit = screen.getByRole("button", {
      name: "Replace portable configuration",
    });
    await user.type(screen.getByLabelText(new RegExp(`Type ${PHRASE}`)), "wrong");
    expect(commit).toBeDisabled();
    await user.clear(screen.getByLabelText(new RegExp(`Type ${PHRASE}`)));
    await user.type(screen.getByLabelText(new RegExp(`Type ${PHRASE}`)), PHRASE);
    await user.type(screen.getByLabelText("Justification"), "Approved recovery drill.");
    await user.type(
      screen.getByLabelText("Re-enter archive passphrase"),
      "archive-passphrase",
    );
    await user.type(screen.getByLabelText("Current password"), "commit-secret");
    await user.type(screen.getByLabelText("Current 6-digit TOTP"), "654321");
    await user.click(commit);

    expect(await screen.findByRole("heading", { name: "Restore completed" }))
      .toBeInTheDocument();
    expect(api.commitRestore).toHaveBeenCalledWith({
      stageId: STAGE_ID,
      previewId: PREVIEW_ID,
      confirmation: PHRASE,
      justification: "Approved recovery drill.",
      passphrase: "archive-passphrase",
      password: "commit-secret",
      totp: "654321",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your session was revoked",
    );
    expect(screen.getByRole("link", { name: "Sign in again" }))
      .toHaveAttribute("href", "/control/login");
    expect(document.body.textContent).not.toContain("commit-secret");
    expect(document.body.textContent).not.toContain("archive-passphrase");
    expect(window.location.search).not.toContain("restore_stage");
  });

  it("clears secrets while preserving safe stage, preview, and justification after failures", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.previewRestore.mockRejectedValueOnce(
      new ControlApiError("vault_unavailable", "Preview is unavailable."),
    );
    render(<RestoreWorkspace role="superadmin" api={api} />);
    await stage(user);

    await user.type(
      screen.getByLabelText("Archive passphrase (optional)"),
      "archive-passphrase",
    );
    await user.click(screen.getByRole("button", { name: "Build restore preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preview is unavailable.",
    );
    expect(screen.getByRole("heading", { name: "Archive validated" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Archive passphrase (optional)")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Build restore preview" }));
    await screen.findByRole("heading", {
      name: "Server-derived replacement preview",
    });
    api.commitRestore.mockRejectedValueOnce(
      new ControlApiError("restore_conflict", "Restore changed."),
    );
    await user.type(screen.getByLabelText(new RegExp(`Type ${PHRASE}`)), PHRASE);
    await user.type(screen.getByLabelText("Justification"), "Keep this safe reason.");
    await user.type(
      screen.getByLabelText("Re-enter archive passphrase"),
      "archive-passphrase",
    );
    await user.type(screen.getByLabelText("Current password"), "commit-secret");
    await user.type(screen.getByLabelText("Current 6-digit TOTP"), "654321");
    await user.click(screen.getByRole("button", {
      name: "Replace portable configuration",
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Restore changed.");
    expect(screen.getByLabelText("Justification")).toHaveValue(
      "Keep this safe reason.",
    );
    expect(screen.getByLabelText("Re-enter archive passphrase")).toHaveValue("");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("Current 6-digit TOTP")).toHaveValue("");
    expect(screen.getByLabelText(new RegExp(`Type ${PHRASE}`))).toHaveValue("");
  });

  it("resumes only server-derived actor-owned state from an opaque URL id", async () => {
    window.history.replaceState(
      null,
      "",
      `/control/backup?restore_stage=${STAGE_ID}`,
    );
    const user = userEvent.setup();
    const api = fakeApi();
    api.resumeRestore.mockResolvedValueOnce({
      ...stageRecord(),
      state: "previewed",
      preview: previewRecord(),
    });
    render(<RestoreWorkspace role="superadmin" api={api} />);
    expect(screen.getByLabelText("Restore stage ID")).toHaveValue(STAGE_ID);
    await user.type(screen.getByLabelText("Current password"), "resume-secret");
    await user.type(screen.getByLabelText("Current 6-digit TOTP"), "123456");
    await user.click(screen.getByRole("button", { name: "Resume restore" }));

    expect(await screen.findByRole("heading", {
      name: "Server-derived replacement preview",
    })).toBeInTheDocument();
    expect(api.resumeRestore).toHaveBeenCalledWith({
      stageId: STAGE_ID,
      password: "resume-secret",
      totp: "123456",
    });
    expect(document.body.textContent).not.toContain("resume-secret");
  });

  it("is absent for non-superadmins and rejects oversized files before API work", async () => {
    const api = fakeApi();
    const restricted = render(
      <RestoreWorkspace role="admin" api={api} />,
    );
    expect(screen.queryByRole("heading", {
      name: "Restore portable configuration",
    })).not.toBeInTheDocument();
    restricted.unmount();

    const user = userEvent.setup();
    render(<RestoreWorkspace role="superadmin" api={api} />);
    const oversized = new File(["x"], "oversized.tar.gz", {
      type: "application/gzip",
    });
    Object.defineProperty(oversized, "size", {
      value: 256 * 1024 * 1024 + 1,
    });
    await user.upload(screen.getByLabelText("Portable restore archive"), oversized);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "archive exceeds the 256 MiB limit",
    );
    expect(screen.getByRole("button", { name: "Upload and validate" }))
      .toBeDisabled();
    expect(api.stageRestore).not.toHaveBeenCalled();
  });
});

async function stage(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const file = new File(["portable archive"], "portable.tar.gz", {
    type: "application/gzip",
  });
  await user.upload(screen.getByLabelText("Portable restore archive"), file);
  await user.type(screen.getByLabelText("Current password"), "stage-secret");
  await user.type(screen.getByLabelText("Current 6-digit TOTP"), "123456");
  await user.click(screen.getByRole("button", { name: "Upload and validate" }));
  await screen.findByRole("heading", { name: "Archive validated" });
}

type FakeRestoreApi = {
  [K in keyof RestoreControlApi]: ReturnType<typeof vi.fn<RestoreControlApi[K]>>;
};

function fakeApi(): FakeRestoreApi {
  return {
    stageRestore: vi.fn(async () => stageRecord()),
    restoreStatus: vi.fn(async () => stageRecord()),
    resumeRestore: vi.fn(async () => stageRecord()),
    previewRestore: vi.fn(async () => previewRecord()),
    commitRestore: vi.fn(async () => ({
      operation_id: "018f1f2e-7b3c-7a10-8000-000000000013",
      stage_id: STAGE_ID,
      preview_id: PREVIEW_ID,
      signed_out: true as const,
      services: 2,
      destinations: 3,
      credentials: 4,
      policies: 5,
      rules: 6,
      remediations: 7,
      revoked_api_keys: 8,
      revoked_sessions: 9,
      revoked_oauth_grants: 10,
    })),
  };
}

function stageRecord(): RestoreStage {
  return {
    id: STAGE_ID,
    archive_id: ARCHIVE_ID,
    archive_bytes: 1234,
    state: "validated",
    expires_at: Date.now() + 60_000,
    version: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

function previewRecord(): RestorePreview {
  return {
    id: PREVIEW_ID,
    stage_id: STAGE_ID,
    archive_sha256: "a".repeat(64),
    plan_digest: "b".repeat(64),
    secret_disposition: "encrypted_secrets",
    counts: {
      services: 2,
      destinations: 3,
      credentials: 4,
      policies: 5,
      rules: 6,
      available_secrets: 4,
      unavailable_secrets: 0,
      replacements: 1,
      removals: 1,
      revoked_api_keys: 8,
      revoked_sessions: 9,
      revoked_oauth_grants: 10,
      remediations: 7,
    },
    confirmation_phrase: PHRASE,
    state: "ready",
    expires_at: Date.now() + 60_000,
    version: 1,
  };
}
