// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/api-keys"}
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApiKeyControlApi,
  ControlApiKey,
  ControlService,
} from "./controlApi";
import { ApiKeysPage } from "./ApiKeyPages";

afterEach(cleanup);

describe("API key workspace", () => {
  it("limits admins to assigned service keys", async () => {
    const user = userEvent.setup();
    const api = fakeApi([]);
    render(<ApiKeysPage role="admin" api={api as unknown as ApiKeyControlApi} />);

    await screen.findByText("No API keys are visible to this role.");
    expect(screen.queryByLabelText("API key role")).not.toBeInTheDocument();
    expect(screen.getByText(/only for one of their services/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nickname"), "Deployment client");
    await user.selectOptions(screen.getByLabelText("Service"), SERVICE.id);
    await user.click(screen.getByRole("button", { name: "Create API key" }));

    await waitFor(() => expect(api.createApiKey).toHaveBeenCalledWith({
      nickname: "Deployment client",
      api_role: "service",
      service_id: SERVICE.id,
      expiration: { policy: "days", days: 90 },
    }));
    expect(screen.queryByText(/current and future services/i)).not.toBeInTheDocument();
  });

  it("requires the exact durable all-services acknowledgement", async () => {
    const user = userEvent.setup();
    const api = fakeApi([]);
    render(<ApiKeysPage role="superadmin" api={api as unknown as ApiKeyControlApi} />);
    await screen.findByText("No API keys are visible to this role.");

    await user.type(screen.getByLabelText("Nickname"), "Fleet automation");
    await user.selectOptions(screen.getByLabelText("API key role"), "all_services");
    expect(screen.getByText(/every service created in the future/i)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Create API key" });
    expect(submit).toBeDisabled();
    await user.type(
      screen.getByLabelText(/I UNDERSTAND THIS KEY COVERS CURRENT AND FUTURE SERVICES/),
      "I understand",
    );
    expect(submit).toBeDisabled();
    await user.clear(
      screen.getByLabelText(/I UNDERSTAND THIS KEY COVERS CURRENT AND FUTURE SERVICES/),
    );
    await user.type(
      screen.getByLabelText(/I UNDERSTAND THIS KEY COVERS CURRENT AND FUTURE SERVICES/),
      ALL_SERVICES_CONFIRMATION,
    );
    await user.click(submit);

    await waitFor(() => expect(api.createApiKey).toHaveBeenCalledWith({
      nickname: "Fleet automation",
      api_role: "all_services",
      expiration: { policy: "days", days: 90 },
      all_services_confirmation: ALL_SERVICES_CONFIRMATION,
    }));
  });

  it("shows a created value once and never reconstructs it from metadata", async () => {
    const user = userEvent.setup();
    const api = fakeApi([]);
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<ApiKeysPage role="superadmin" api={api as unknown as ApiKeyControlApi} />);
    await screen.findByText("No API keys are visible to this role.");
    await user.type(screen.getByLabelText("Nickname"), "System automation");
    await user.selectOptions(screen.getByLabelText("API key role"), "system");
    await user.click(screen.getByRole("button", { name: "Create API key" }));

    const panel = await screen.findByRole("heading", { name: "Copy this API key now" });
    const section = panel.closest("section")!;
    expect(within(section).getByLabelText("One-time API key")).toHaveTextContent(RAW_KEY);
    await user.click(within(section).getByRole("button", { name: "Copy API key" }));
    expect(writeText).toHaveBeenCalledWith(RAW_KEY);
    await user.click(within(section).getByRole("button", { name: "I have stored it" }));
    expect(screen.queryByText(RAW_KEY)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(api.listApiKeys).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(RAW_KEY)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("$argon2id");
  });

  it("rotates from metadata and exposes only the replacement value once", async () => {
    const user = userEvent.setup();
    const api = fakeApi([API_KEY]);
    render(<ApiKeysPage role="superadmin" api={api as unknown as ApiKeyControlApi} />);
    expect(await screen.findByRole("heading", { name: API_KEY.nickname }))
      .toBeInTheDocument();
    expect(await screen.findByText("authenticate")).toBeInTheDocument();
    expect(screen.getByText(/allow · management route/i)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Rotation or revocation justification"),
      "Scheduled credential rotation.",
    );
    await user.click(screen.getByRole("button", { name: "Rotate key" }));
    await waitFor(() => expect(api.rotateApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ id: API_KEY.id, version: API_KEY.version }),
      "Scheduled credential rotation.",
    ));
    expect(await screen.findByLabelText("One-time API key")).toHaveTextContent(ROTATED_KEY);
    await user.click(screen.getByRole("button", { name: "I have stored it" }));
    expect(screen.queryByText(ROTATED_KEY)).not.toBeInTheDocument();
  });
});

const ALL_SERVICES_CONFIRMATION =
  "I UNDERSTAND THIS KEY COVERS CURRENT AND FUTURE SERVICES";
const RAW_KEY = `ssk_v1_${"A".repeat(16)}_${"B".repeat(43)}`;
const ROTATED_KEY = `ssk_v1_${"C".repeat(16)}_${"D".repeat(43)}`;

const SERVICE: ControlService = {
  id: "018f1f2e-7b3c-7a10-8000-000000000010",
  slug: "managed-api",
  name: "Managed API",
  lifecycle: "published",
  draft_matches_published: true,
  publication_generation: 1,
  destination_count: 1,
  admin_count: 1,
  version: 2,
  created_at: 1,
  updated_at: 2,
};

const API_KEY: ControlApiKey = {
  id: "018f1f2e-7b3c-7a10-8000-000000000020",
  key_prefix: `ssk_v1_${"A".repeat(16)}`,
  nickname: "Release worker",
  last_four: "wX9_",
  api_role: "service",
  service_id: SERVICE.id,
  expiration_policy: "timestamp",
  expires_at: 2_000_000_000_000,
  status: "active",
  creator_id: "018f1f2e-7b3c-7a10-8000-000000000030",
  version: 3,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_001,
};

function fakeApi(initial: ControlApiKey[]) {
  let keys = [...initial];
  return {
    listServices: vi.fn(async () => ({ services: [SERVICE] })),
    listApiKeys: vi.fn(async () => ({ api_keys: keys })),
    apiKey: vi.fn(async () => keys[0]!),
    createApiKey: vi.fn(async (input: { nickname: string }) => {
      const apiKey = { ...API_KEY, nickname: input.nickname, api_role: "system" as const };
      keys = [apiKey, ...keys];
      return {
        api_key: apiKey,
        one_time_key: RAW_KEY,
        one_time_value_displayed: true as const,
      };
    }),
    updateApiKey: vi.fn(async (apiKey: ControlApiKey) => apiKey),
    revokeApiKey: vi.fn(async (apiKey: ControlApiKey) => ({
      api_key: { ...apiKey, status: "revoked" as const },
      changed: true,
    })),
    rotateApiKey: vi.fn(async (apiKey: ControlApiKey) => ({
      api_key: { ...apiKey, version: apiKey.version + 1 },
      one_time_key: ROTATED_KEY,
      one_time_value_displayed: true as const,
    })),
    apiKeyActivity: vi.fn(async () => ({
      activity: initial.length === 0 ? [] : [{
        id: "018f1f2e-7b3c-7a10-8000-000000000040",
        api_key_id: API_KEY.id,
        nickname: API_KEY.nickname,
        last_four: API_KEY.last_four,
        api_role: API_KEY.api_role,
        service_id: SERVICE.id,
        action: "authenticate",
        outcome: "allow" as const,
        target_type: "management_route",
        request_id: "request-safe-metadata",
        occurred_at: 1_700_000_000_100,
      }],
    })),
  };
}
