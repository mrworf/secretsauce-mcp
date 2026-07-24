// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://control.example.org/control/services"}
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserControlApi,
  ControlApiError,
  type ControlCredential,
  type ControlServiceDetail,
} from "./controlApi";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("service browser API", () => {
  it("stages raw restore bytes and binds commit proof to the exact safe body", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const stageId = "018f1f2e-7b3c-7a10-8000-000000000070";
    const previewId = "018f1f2e-7b3c-7a10-8000-000000000071";
    const responses = [
      envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }),
      envelope({ mode: "five_minutes", expires_at: 10 }),
      envelope({
        id: stageId,
        archive_id: "018f1f2e-7b3c-7a10-8000-000000000072",
        archive_bytes: 7,
        state: "validated",
        expires_at: 10,
        version: 1,
        created_at: 1,
        updated_at: 1,
      }),
      envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }),
      envelope({ mode: "always", expires_at: 10, proof: "p".repeat(43) }),
      envelope({
        operation_id: "018f1f2e-7b3c-7a10-8000-000000000073",
        stage_id: stageId,
        preview_id: previewId,
        signed_out: true,
        services: 1,
        destinations: 1,
        credentials: 1,
        policies: 1,
        rules: 1,
        remediations: 4,
        revoked_api_keys: 2,
        revoked_sessions: 3,
        revoked_oauth_grants: 4,
      }),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return responses.shift()!;
    }));
    const archive = new File(["archive"], "portable.tar.gz", {
      type: "application/gzip",
    });
    await browserControlApi.stageRestore({
      archive,
      password: "stage-password",
      totp: "123456",
    });
    expect(requests[2]).toMatchObject({
      url: "/api/v2/restores/stages",
      init: {
        method: "POST",
        body: archive,
        headers: {
          "content-type": "application/gzip",
          "x-csrf-token": "x".repeat(43),
        },
      },
    });
    expect(String(requests[2]!.init.body)).not.toContain("stage-password");

    const body = {
      preview_id: previewId,
      confirmation: "RESTORE exact-archive",
      justification: "Approved replacement.",
      passphrase: "archive-passphrase",
    };
    await browserControlApi.commitRestore({
      stageId,
      previewId,
      confirmation: body.confirmation,
      justification: body.justification,
      passphrase: body.passphrase,
      password: "commit-password",
      totp: "654321",
    });
    expect(JSON.parse(String(requests[4]!.init.body))).toEqual({
      password: "commit-password",
      totp: "654321",
      operation: {
        method: "POST",
        route_id: "restores.commit",
        target_ids: [stageId],
        body,
      },
    });
    expect(requests[5]).toMatchObject({
      url: `/api/v2/restores/${stageId}/commit`,
      init: {
        method: "POST",
        headers: { "x-step-up-proof": "p".repeat(43) },
      },
    });
    expect(JSON.parse(String(requests[5]!.init.body))).toEqual(body);
    expect(String(requests[5]!.init.body)).not.toContain("commit-password");
    expect(String(requests[5]!.init.body)).not.toContain("654321");
  });

  it("binds a binary backup to the exact stepped-up body and validates delivery headers", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }),
      envelope({ mode: "always", expires_at: 10, proof: "p".repeat(43) }),
      new Response("archive", {
        status: 200,
        headers: {
          "content-type": "application/gzip",
          "content-disposition":
            'attachment; filename="secretsauce-portable-backup.tar.gz"',
        },
      }),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return responses.shift()!;
    }));
    const body = {
      include_secrets: true,
      acknowledgement: "exact exclusion acknowledgement",
      passphrase: "separate-passphrase",
    };

    await expect(browserControlApi.createPortableBackup({
      ...body,
      password: "current-password",
      totp: "123456",
    })).resolves.toEqual(expect.any(Blob));

    expect(JSON.parse(String(requests[1]!.init.body))).toEqual({
      password: "current-password",
      totp: "123456",
      operation: {
        method: "POST",
        route_id: "backups.create_interactive",
        target_ids: [],
        body,
      },
    });
    expect(requests[2]).toMatchObject({
      url: "/api/v2/backups/interactive",
      init: { method: "POST" },
    });
    expect(requests[2]!.init.headers).toMatchObject({
      "x-step-up-proof": "p".repeat(43),
    });
    expect(JSON.parse(String(requests[2]!.init.body))).toEqual(body);
    expect(String(requests[2]!.init.body)).not.toContain("current-password");
    expect(String(requests[2]!.init.body)).not.toContain("123456");
  });

  it("rejects an invalid binary backup response without returning its body", async () => {
    const responses = [
      envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }),
      envelope({ mode: "always", expires_at: 10, proof: "p".repeat(43) }),
      new Response("not-an-archive", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => responses.shift()!));

    await expect(browserControlApi.createPortableBackup({
      include_secrets: false,
      acknowledgement: "exact exclusion acknowledgement",
      password: "current-password",
      totp: "123456",
    })).rejects.toEqual(expect.objectContaining<Partial<ControlApiError>>({
      code: "invalid_response",
    }));
  });

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

  it("binds self API key approval to the exact body, credential version, and one proof", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const approval = {
      api_key_id: "018f1f2e-7b3c-7a10-8000-000000000030",
      nickname: "Recursive integration",
      last_four: "CAgI",
      vault_generation: 4,
      approved_at: 10,
    };
    const responses = [
      envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }),
      envelope({ mode: "always", expires_at: 10, proof: "p".repeat(43) }),
      envelope({ credential: CREDENTIAL, approval }),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return responses.shift()!;
    }));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "018f1f2e-7b3c-7a10-8000-000000000099",
    );
    const raw =
      "ssk_v1_AQEBAQEBAQEBAQEB_AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI";
    const body = {
      value: raw,
      capture_last_four: true,
      justification: "Explicit recursive integration.",
      risk_acknowledgement:
        "I ACCEPT RECURSIVE SECRETSAUCE MANAGEMENT AUTHORITY",
    };

    await expect(browserControlApi.approveSelfApiKey(CREDENTIAL, {
      ...body,
      password: "current-password",
      totp: "123456",
    })).resolves.toEqual({ credential: CREDENTIAL, approval });

    expect(requests).toHaveLength(3);
    expect(JSON.parse(String(requests[1]!.init.body))).toEqual({
      password: "current-password",
      totp: "123456",
      operation: {
        method: "PUT",
        route_id: "credentials.self_api_key.approve",
        target_ids: [SERVICE.id, CREDENTIAL.id],
        expected_version: CREDENTIAL.version,
        idempotency_key: "018f1f2e-7b3c-7a10-8000-000000000099",
        body,
      },
    });
    expect(requests[2]).toMatchObject({
      url:
        `/api/v2/services/${SERVICE.id}/credentials/${CREDENTIAL.id}/self-api-key`,
      init: { method: "PUT" },
    });
    expect(requests[2]!.init.headers).toMatchObject({
      "x-step-up-proof": "p".repeat(43),
      "if-match": `"${CREDENTIAL.version}"`,
      "idempotency-key": "018f1f2e-7b3c-7a10-8000-000000000099",
    });
    expect(JSON.parse(String(requests[2]!.init.body))).toEqual(body);
    expect(String(requests[2]!.init.body)).not.toContain("current-password");
    expect(String(requests[2]!.init.body)).not.toContain("123456");
  });

  it("marks only explicit security reads and binds global events exactly", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      envelope({ items: [], state_version: 7 }),
      envelope({
        user_id: SERVICE.id,
        role: "superadmin",
        csrf_token: "x".repeat(43),
        expires_at: 10,
      }),
      envelope({ mode: "always", expires_at: 10, proof: "p".repeat(43) }),
      envelope({
        id: "018f1f2e-7b3c-7a10-8000-000000000060",
        kind: "totp_reset",
        actor_user_id: SERVICE.id,
        actor_role: "superadmin",
        justification: "Replace authenticators.",
        affected_users: 2,
        resulting_global_epoch: 8,
        resulting_password_policy_version: 2,
        created_at: 10,
        replayed: false,
      }),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return responses.shift()!;
    }));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "018f1f2e-7b3c-7a10-8000-000000000099",
    );

    await browserControlApi.securityEvents();
    await browserControlApi.executeGlobalSecurityEvent("totp_reset", 7, {
      justification: "Replace authenticators.",
      acknowledgement: "ERASE ALL LOCAL TOTP AUTHENTICATORS",
      password: "current-password",
      totp: "123456",
    });

    expect(requests[0]).toMatchObject({
      url: "/api/v2/security/events",
      init: {
        method: "GET",
        headers: { "x-secretsauce-user-activity": "interactive" },
      },
    });
    expect(JSON.parse(String(requests[2]!.init.body))).toEqual({
      password: "current-password",
      totp: "123456",
      operation: {
        method: "POST",
        route_id: "security.events.totp_reset",
        target_ids: [],
        expected_version: 7,
        idempotency_key: "018f1f2e-7b3c-7a10-8000-000000000099",
        body: {
          justification: "Replace authenticators.",
          acknowledgement: "ERASE ALL LOCAL TOTP AUTHENTICATORS",
        },
      },
    });
    expect(requests[3]!.init.headers).toMatchObject({
      "x-step-up-proof": "p".repeat(43),
      "if-match": "\"7\"",
      "idempotency-key": "018f1f2e-7b3c-7a10-8000-000000000099",
    });
    expect(String(requests[3]!.init.body)).not.toContain("current-password");
    expect(String(requests[3]!.init.body)).not.toContain("123456");
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

const CREDENTIAL: ControlCredential = {
  id: "018f1f2e-7b3c-7a10-8000-000000000020",
  service_id: SERVICE.id,
  name: "Self API key",
  placement: {
    kind: "header",
    name: "Authorization",
    prefix: "Bearer ",
    enforce_header_ownership: true,
  },
  selector: { kind: "all", group_ids: [], user_ids: [] },
  status: "configured",
  authorization_generation: 1,
  version: 3,
  created_at: 1,
  updated_at: 2,
};

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
