// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessPage } from "./AccessPages";
import type { AccessControlApi } from "./controlApi";

const USER = "018f1f2e-7b3c-7a10-8000-000000000501";
const SESSION = "018f1f2e-7b3c-7a10-8000-000000000502";
const GRANT = "018f1f2e-7b3c-7a10-8000-000000000503";
const CLIENT = "018f1f2e-7b3c-7a10-8000-000000000504";
const SERVICE = "018f1f2e-7b3c-7a10-8000-000000000505";

afterEach(cleanup);

describe("access and sessions workspace", () => {
  it("shows personal sessions and MCP connections without protected values", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const view = render(<AccessPage role="user" api={api} />);

    expect(await screen.findByRole("heading", { name: "Your sessions" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your MCP connections" }))
      .toBeInTheDocument();
    expect(screen.getByText("Current services: Payments API")).toBeInTheDocument();
    expect(view.container.innerHTML).not.toMatch(
      /gref_|sec_|token_hash|refresh_token|credential_value/i,
    );
    await user.click(screen.getByRole("button", { name: "Revoke connection" }));
    await waitFor(() => expect(api.revokeOAuthGrant).toHaveBeenCalledWith(GRANT));
    expect(await screen.findByText("OAuth connection revoked.")).toBeInTheDocument();
  });

  it("keeps service capability invalidation distinct from OAuth revocation", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<AccessPage role="admin" api={api} />);

    expect(await screen.findByRole("heading", { name: "Dynamic service access" }))
      .toBeInTheDocument();
    expect(screen.getByText(/Invalidating a capability removes current dynamic references/))
      .toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Invalidation justification"),
      "Remove current dynamic access.",
    );
    await user.click(screen.getByRole("button", { name: "Invalidate capabilities" }));
    await waitFor(() => expect(api.invalidateCapabilities).toHaveBeenCalledWith(
      SERVICE,
      { kind: "assignment", user_id: USER },
      "Remove current dynamic access.",
    ));
    expect(await screen.findByText(
      "3 dynamic references invalidated; no OAuth grants were revoked.",
    )).toBeInTheDocument();
  });
});

function fakeApi(): AccessControlApi & {
  revokeOAuthGrant: ReturnType<typeof vi.fn<AccessControlApi["revokeOAuthGrant"]>>;
  invalidateCapabilities:
    ReturnType<typeof vi.fn<AccessControlApi["invalidateCapabilities"]>>;
} {
  return {
    listSessions: async () => ({
      items: [{
        id: SESSION,
        user_id: USER,
        user_label: "Example User (user@example.org)",
        role: "user",
        current: true,
        issued_at: 1,
        last_used_at: 2,
        expires_at: 3,
        status: "active",
      }],
    }),
    listOAuthGrants: async () => ({
      items: [{
        id: GRANT,
        user_id: USER,
        user_label: "Example User (user@example.org)",
        client_id: CLIENT,
        client_identifier: "https://client.example.org/metadata.json",
        client_name: "Example MCP Client",
        resource: "https://mcp.example.org",
        scopes: ["gateway.read"],
        authentication_method: "local_password_totp",
        issued_at: 1,
        last_used_at: 2,
        expires_at: 3,
        oauth_grant_status: "active",
        usable: true,
        services: ["Payments API"],
      }],
    }),
    revokeSession: async () => ({ target_id: SESSION, revoked: true }),
    revokeOAuthGrant: vi.fn<AccessControlApi["revokeOAuthGrant"]>(
      async () => ({ target_id: GRANT, revoked: true }),
    ),
    listServices: async () => ({
      services: [{
        id: SERVICE,
        slug: "payments",
        name: "Payments API",
        lifecycle: "published",
        draft_matches_published: true,
        publication_generation: 1,
        destination_count: 1,
        admin_count: 1,
        version: 1,
        created_at: 1,
        updated_at: 1,
      }],
    }),
    serviceGrantAccess: async () => ({
      items: [{
        grant_id: GRANT,
        user_id: USER,
        user_label: "Example User (user@example.org)",
        client_id: CLIENT,
        client_identifier: "https://client.example.org/metadata.json",
        client_name: "Example MCP Client",
        service_id: SERVICE,
        service_name: "Payments API",
        issued_at: 1,
        last_used_at: 2,
        expires_at: 3,
        oauth_grant_status: "active",
        capability_status: "active",
        credential_count: 1,
        policy_count: 1,
        references: {
          gref: { active: 2, expired: 0, invalid: 0 },
          sec: { active: 1, expired: 0, invalid: 0 },
        },
      }],
    }),
    invalidateCapabilities: vi.fn<AccessControlApi["invalidateCapabilities"]>(
      async () => ({
        capability_status: "invalidated",
        invalidated_references: 3,
        oauth_grants_revoked: 0,
      }),
    ),
  };
}
