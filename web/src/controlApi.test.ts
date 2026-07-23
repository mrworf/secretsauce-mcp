// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/services"}
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserControlApi, ControlApiError, type ControlServiceDetail } from "./controlApi";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("service browser API", () => {
  it("binds permanent deletion proof to the exact request and consumes it once", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }),
      envelope({ mode: "always", expires_at: 10, proof: "p".repeat(43) }),
      envelope({ service_id: SERVICE.id, deleted: true }),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return responses.shift()!;
    }));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "018f1f2e-7b3c-7a10-8000-000000000099",
    );

    await expect(browserControlApi.deleteService(
      SERVICE,
      "Retired and unowned.",
      "current-password",
      "123456",
    )).resolves.toEqual({ service_id: SERVICE.id, deleted: true });

    expect(requests).toHaveLength(3);
    const stepUpBody = JSON.parse(String(requests[1]!.init.body));
    expect(stepUpBody.operation).toEqual({
      method: "DELETE",
      route_id: "services.delete",
      target_ids: [SERVICE.id],
      expected_version: SERVICE.version,
      idempotency_key: "018f1f2e-7b3c-7a10-8000-000000000099",
      body: { justification: "Retired and unowned." },
    });
    expect(requests[2]).toMatchObject({
      url: `/api/v2/services/${SERVICE.id}`,
      init: { method: "DELETE" },
    });
    expect(requests[2]!.init.headers).toMatchObject({
      "x-step-up-proof": "p".repeat(43),
      "if-match": `"${SERVICE.version}"`,
      "idempotency-key": "018f1f2e-7b3c-7a10-8000-000000000099",
    });
    expect(String(requests[2]!.init.body)).not.toContain("current-password");
    expect(String(requests[2]!.init.body)).not.toContain("123456");
  });

  it("fails closed when step-up does not return an operation-bound proof", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }))
      .mockResolvedValueOnce(envelope({ mode: "five_minutes", expires_at: 10 }));
    vi.stubGlobal("fetch", fetch);

    await expect(browserControlApi.deleteService(
      SERVICE,
      "Retired and unowned.",
      "current-password",
      "123456",
    )).rejects.toEqual(expect.objectContaining<Partial<ControlApiError>>({
      code: "step_up_required",
    }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

const SERVICE: ControlServiceDetail = {
  id: "018f1f2e-7b3c-7a10-8000-000000000010",
  slug: "managed-api",
  name: "Managed API",
  lifecycle: "archived",
  draft_matches_published: false,
  publication_generation: 2,
  destination_count: 0,
  admin_count: 0,
  version: 7,
  created_at: 1,
  updated_at: 2,
  destinations: [],
};

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
