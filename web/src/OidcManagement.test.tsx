// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OidcLinksPanel } from "./UserPages";
import type {
  ControlApi,
  ControlUser,
  OidcControlApi,
  OidcManagementApi,
} from "./controlApi";

const user: ControlUser = {
  id: "019f9a4a-7a00-7000-8000-000000000001",
  email: "user@example.org",
  given_name: "Example",
  family_name: "User",
  role: "user",
  status: "active",
  password_state: "disabled",
  totp_state: "disabled",
  version: 2,
  created_at: 1,
  updated_at: 2,
};

describe("external identity management view", () => {
  it("shows safe link labels and confirms a version-bound unlink with justification", async () => {
    const onVersion = vi.fn();
    const api = {
      oidcProviders: vi.fn().mockResolvedValue({
        providers: [{ id: "workforce", display_name: "Workforce" }],
      }),
      listOidcLinks: vi.fn().mockResolvedValue({
        links: [{
          id: "019f9a4a-7a00-7000-8000-000000000010",
          provider_id: "workforce",
          provider_display_name: "Workforce",
          created_at: 1,
        }],
      }),
      unlinkOidc: vi.fn().mockResolvedValue({
        user_id: user.id,
        deleted: true,
        version: 3,
      }),
      beginOidcLink: vi.fn(),
    } as unknown as ControlApi & OidcControlApi & OidcManagementApi;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OidcLinksPanel user={user} api={api} onVersion={onVersion} />);
    expect(within(await screen.findByRole("list")).getByText("Workforce")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Justification"), {
      target: { value: "Replace the former workforce account." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    await waitFor(() => expect(api.unlinkOidc).toHaveBeenCalledWith(
      user,
      "019f9a4a-7a00-7000-8000-000000000010",
      "Replace the former workforce account.",
    ));
    expect(onVersion).toHaveBeenCalledWith(3);
    expect(screen.queryByText(/subject|immutable/i)).not.toBeInTheDocument();
  });
});
