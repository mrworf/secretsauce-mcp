import { stringify as stringifyYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { createPortableArchive } from "../src/portableArchive.js";
import {
  decodeRestoreArchive,
  RestoreArchiveError,
} from "../src/restoreArchive.js";

const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000099";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const DESTINATION_ID = "018f1f2e-7b3c-7a10-8000-000000000011";
const CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const POLICY_ID = "018f1f2e-7b3c-7a10-8000-000000000030";
const RULE_ID = "018f1f2e-7b3c-7a10-8000-000000000031";
const LOCATOR = "018f1f2e-7b3c-4a10-8000-000000000040";

describe("restore archive decoder", () => {
  it("builds a canonical credential-less plan with exact references and counts", () => {
    const decoded = decodeRestoreArchive(archive());
    expect(decoded).toMatchObject({
      archiveId: ARCHIVE_ID,
      archiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      counts: {
        services: 1,
        destinations: 1,
        credentials: 1,
        policies: 1,
        rules: 1,
        secrets: 0,
      },
      secretSelection: [],
      services: [{ id: SERVICE_ID, destinations: [{ id: DESTINATION_ID }] }],
      credentials: [{ id: CREDENTIAL_ID, service_id: SERVICE_ID }],
      policies: [{
        id: POLICY_ID,
        service_id: SERVICE_ID,
        credential_id: CREDENTIAL_ID,
        rules: [{ id: RULE_ID }],
      }],
    });
    expect(decoded).not.toHaveProperty("secrets");
  });

  it("binds encrypted payload selection without interpreting secret bytes", () => {
    const input = fixture();
    input.credentials.credentials[0]!.status = "disabled";
    input.credentials.credentials[0]!.secret_record = {
      locator: LOCATOR,
      generation: 3,
    };
    const secrets = Buffer.from([0, 1, 2, 255]);
    const decoded = decodeRestoreArchive(archive({
      input,
      mode: "encrypted-secrets",
      secrets,
    }));
    expect(decoded.secretSelection).toEqual([{
      serviceId: SERVICE_ID,
      destinationId: SERVICE_ID,
      credentialId: CREDENTIAL_ID,
      locator: LOCATOR,
      generation: 3,
    }]);
    expect(decoded.secrets).toEqual(secrets);
  });

  it("rejects malformed YAML features, unknown fields, and noncanonical bytes", () => {
    const cases = [
      Buffer.from("kind: services\nkind: services\nschema_version: 1\nservices: []\n"),
      Buffer.from("kind: services\nschema_version: 1\nservices: &items []\n"),
      Buffer.from("copy: *items\nkind: services\nschema_version: 1\nservices: &items []\n"),
      Buffer.from("kind: services\nschema_version: 1\nservices: !custom []\n"),
      canonicalYaml({
        extra: true,
        kind: "services",
        schema_version: 1,
        services: [],
      }),
      Buffer.from("schema_version: 1\nkind: services\nservices: []\n"),
    ];
    for (const services of cases) {
      expect(() => decodeRestoreArchive(archive({
        documents: { services },
        counts: emptyCounts(),
      }))).toThrowError(new RestoreArchiveError("invalid"));
    }
  });

  it("distinguishes unsupported document schemas", () => {
    const services = canonicalYaml({
      kind: "services",
      schema_version: 2,
      services: [],
    });
    expect(() => decodeRestoreArchive(archive({
      documents: { services },
      counts: emptyCounts(),
    }))).toThrowError(new RestoreArchiveError("unsupported"));
  });

  it("enforces YAML depth before object construction", () => {
    let nested = "value";
    for (let index = 0; index < 34; index += 1) nested = `[${nested}]`;
    const services = Buffer.from(`kind: services\nschema_version: 1\nservices: ${nested}\n`);
    expect(() => decodeRestoreArchive(archive({
      documents: { services },
      counts: emptyCounts(),
    }))).toThrowError(new RestoreArchiveError("too_large"));
  });

  it("rejects manifest count and archive checksum inconsistencies", () => {
    expect(() => decodeRestoreArchive(archive({
      counts: { ...counts(), rules: 0 },
    }))).toThrowError(new RestoreArchiveError("inconsistent"));
    const damaged = archive();
    damaged[damaged.byteLength - 5] ^= 0xff;
    expect(() => decodeRestoreArchive(damaged))
      .toThrowError(new RestoreArchiveError("corrupt"));
  });

  it("rejects duplicate identities, names, and invalid cross-references", () => {
    const duplicateId = fixture();
    duplicateId.services.services[0]!.destinations.push({
      ...duplicateId.services.services[0]!.destinations[0]!,
      slug: "secondary",
    });
    expectInvalid(duplicateId, { ...counts(), destinations: 2 });

    const duplicateName = fixture();
    duplicateName.policies.policies[0]!.rules.push({
      ...duplicateName.policies.policies[0]!.rules[0]!,
      id: "018f1f2e-7b3c-7a10-8000-000000000032",
      name: " allow widgets ",
    });
    expectInvalid(duplicateName, { ...counts(), rules: 2 });

    const missingService = fixture();
    missingService.credentials.credentials[0]!.service_id =
      "018f1f2e-7b3c-7a10-8000-000000000088";
    expectInvalid(missingService);

    const wrongBoundary = fixture();
    wrongBoundary.policies.policies[0]!.credential_id =
      "018f1f2e-7b3c-7a10-8000-000000000088";
    expectInvalid(wrongBoundary);

    const wrongOrder = fixture();
    wrongOrder.policies.policies[0]!.rules.push({
      ...wrongOrder.policies.policies[0]!.rules[0]!,
      id: "018f1f2e-7b3c-7a10-8000-000000000032",
      name: "Later rule",
      priority: 101,
    });
    expectInvalid(wrongOrder, { ...counts(), rules: 2 });
  });

  it("rejects noncanonical or unsafe destinations, matchers, and usage", () => {
    const destination = fixture();
    destination.services.services[0]!.destinations[0]!.base_url =
      "https://user:pass@api.example.org/";
    expectInvalid(destination);

    const matcher = fixture();
    matcher.policies.policies[0]!.rules[0]!.paths =
      [{ kind: "regex", value: "^(a+)+$" }];
    expectInvalid(matcher);

    const method = fixture();
    method.policies.policies[0]!.rules[0]!.methods = ["get"];
    expectInvalid(method);

    const usage = fixture();
    usage.credentials.credentials[0]!.usage.name = "Host";
    expectInvalid(usage);
  });

  it("requires secret metadata to agree exactly with archive mode", () => {
    const credentialless = fixture();
    credentialless.credentials.credentials[0]!.secret_record = {
      locator: LOCATOR,
      generation: 1,
    };
    credentialless.credentials.credentials[0]!.status = "configured";
    expectInvalid(credentialless);

    const configuredWithoutSecret = fixture();
    configuredWithoutSecret.credentials.credentials[0]!.status = "configured";
    expectInvalid(configuredWithoutSecret);

    const encrypted = fixture();
    encrypted.credentials.credentials[0]!.secret_record = {
      locator: LOCATOR,
      generation: 1,
    };
    expect(() => decodeRestoreArchive(archive({
      input: encrypted,
      mode: "encrypted-secrets",
      secrets: Buffer.from("opaque"),
      counts: { ...counts(), secrets: 1 },
    }))).toThrowError(new RestoreArchiveError("inconsistent"));
  });
});

function expectInvalid(
  input: ReturnType<typeof fixture>,
  objectCounts = counts(),
): void {
  try {
    decodeRestoreArchive(archive({ input, counts: objectCounts }));
    throw new Error("expected restore archive rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(RestoreArchiveError);
    expect(["invalid", "inconsistent"]).toContain(
      (error as RestoreArchiveError).code,
    );
  }
}

function archive(options: {
  input?: ReturnType<typeof fixture>;
  documents?: { services?: Uint8Array };
  counts?: ReturnType<typeof counts>;
  mode?: "credential-less" | "encrypted-secrets";
  secrets?: Uint8Array;
} = {}): Buffer {
  const input = options.input ?? fixture();
  const mode = options.mode ?? "credential-less";
  return createPortableArchive({
    archiveId: ARCHIVE_ID,
    productVersion: "0.1.0-test",
    createdAtUtcMs: 1_800_000_000_000,
    mode,
    counts: options.counts ?? {
      ...counts(),
      secrets: mode === "encrypted-secrets"
        ? input.credentials.credentials.filter(
            (entry) => entry.secret_record !== undefined,
          ).length
        : 0,
    },
    documents: {
      services: options.documents?.services ?? canonicalYaml(input.services),
      credentials: canonicalYaml(input.credentials),
      policies: canonicalYaml(input.policies),
    },
    ...(mode === "encrypted-secrets"
      ? { secrets: options.secrets ?? Buffer.from("opaque") }
      : {}),
  }).archive;
}

function counts() {
  return {
    services: 1,
    destinations: 1,
    credentials: 1,
    policies: 1,
    rules: 1,
    secrets: 0,
  };
}

function emptyCounts() {
  return {
    services: 0,
    destinations: 0,
    credentials: 0,
    policies: 0,
    rules: 0,
    secrets: 0,
  };
}

function fixture() {
  return {
    services: {
      schema_version: 1 as const,
      kind: "services" as const,
      services: [{
        id: SERVICE_ID,
        slug: "widgets",
        name: "Widget Service",
        description: "Portable configuration",
        documentation_url: "https://docs.example.org/widgets",
        lifecycle: "published" as const,
        destinations: [{
          id: DESTINATION_ID,
          slug: "primary",
          base_url: "https://api.example.org/",
          schemes: ["https" as const],
          hosts: [{ kind: "exact" as const, value: "api.example.org" }],
          ports: [443],
          tls: { verify: true },
        }],
      }],
    },
    credentials: {
      schema_version: 1 as const,
      kind: "credentials" as const,
      credentials: [{
        id: CREDENTIAL_ID,
        service_id: SERVICE_ID,
        name: "Widget key",
        usage: {
          kind: "header" as const,
          name: "X-Widget-Key",
          prefix: "Bearer ",
          enforce_header_ownership: true,
        },
        status: "unconfigured" as
          "configured" | "unconfigured" | "disabled" | "archived",
        secret_record: undefined as
          { locator: string; generation: number } | undefined,
      }],
    },
    policies: {
      schema_version: 1 as const,
      kind: "policies" as const,
      policies: [{
        id: POLICY_ID,
        service_id: SERVICE_ID,
        credential_id: CREDENTIAL_ID,
        name: "Widget access",
        operating_mode: "allow" as const,
        lifecycle: "active" as const,
        rules: [{
          id: RULE_ID,
          name: "Allow widgets",
          effect: "allow" as const,
          priority: 100,
          enabled: true,
          methods: ["GET"],
          hosts: [{ kind: "exact" as const, value: "api.example.org" }],
          paths: [{ kind: "prefix" as const, value: "/widgets" }],
          response_safeguards: {
            secretlint: {
              enabled: true,
              disabled_rule_ids: [] as string[],
            },
            binary_response: { scan: true, max_bytes: 1_024 },
          },
        }],
      }],
    },
  };
}

function canonicalYaml(value: unknown): Buffer {
  const source = stringifyYaml(sortValue(value), {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  });
  return Buffer.from(source.endsWith("\n") ? source : `${source}\n`, "utf8");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}
