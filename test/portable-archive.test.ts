import { gzipSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  PORTABLE_EXCLUDED_DOMAINS,
  PortableArchiveError,
  createPortableArchive,
  parsePortableArchive,
} from "../src/portableArchive.js";

const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000099";
const COUNTS = {
  services: 1,
  destinations: 1,
  credentials: 1,
  policies: 1,
  rules: 1,
  secrets: 0,
};

describe("portable tar/gzip archive", () => {
  it("creates a deterministic credential-less archive with canonical checksums", () => {
    const input = fixture();
    const first = createPortableArchive(input);
    const second = createPortableArchive(input);
    expect(first.archive).toEqual(second.archive);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.archive.subarray(0, 3)).toEqual(Buffer.from([0x1f, 0x8b, 0x08]));
    expect(first.archive[4]).toBe(0);
    expect(first.archive[5]).toBe(0);
    expect(first.archive[6]).toBe(0);
    expect(first.archive[7]).toBe(0);

    const parsed = parsePortableArchive(first.archive);
    expect([...parsed.entries]).toEqual([
      ["manifest.yaml", expect.any(Buffer)],
      ["services.yaml", Buffer.from("kind: services\nname: Café\n")],
      ["credentials.yaml", Buffer.from("kind: credentials\ncredentials: []\n")],
      ["policies.yaml", Buffer.from("kind: policies\npolicies: []\n")],
    ]);
    expect(parsed.manifest).toMatchObject({
      archive_id: ARCHIVE_ID,
      archive_type: "secretsauce-portable-configuration",
      schema_version: 1,
      product_version: "0.1.0-test",
      created_at_utc_ms: 1_800_000_000_000,
      mode: "credential-less",
      object_counts: COUNTS,
      file_order: [
        "manifest.yaml",
        "services.yaml",
        "credentials.yaml",
        "policies.yaml",
      ],
    });
    expect(parsed.manifest.excluded_domains).toEqual([
      ...PORTABLE_EXCLUDED_DOMAINS,
    ]);
    expect(parsed.manifest).not.toHaveProperty("encryption");
    expect(parsed.manifest.files).toEqual([
      {
        name: "services.yaml",
        bytes: 27,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      {
        name: "credentials.yaml",
        bytes: 34,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      {
        name: "policies.yaml",
        bytes: 28,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    ]);
  });

  it("round-trips an encrypted payload and publishes only fixed KDF metadata", () => {
    const result = createPortableArchive({
      ...fixture(),
      mode: "encrypted-secrets",
      counts: { ...COUNTS, secrets: 1 },
      secrets: Buffer.from([0, 1, 2, 255]),
    });
    const parsed = parsePortableArchive(result.archive);
    expect([...parsed.entries.keys()]).toEqual([
      "manifest.yaml",
      "services.yaml",
      "credentials.yaml",
      "policies.yaml",
      "secrets.enc",
    ]);
    expect(parsed.entries.get("secrets.enc")).toEqual(Buffer.from([0, 1, 2, 255]));
    expect(parsed.manifest.encryption).toEqual({
      format: "SSVA0001",
      cipher: "AES-256-GCM",
      kdf: "Argon2id",
      memory_kib: 65_536,
      iterations: 3,
      parallelism: 1,
      salt_bytes: 16,
      nonce_bytes: 12,
      selected_count: 1,
    });
  });

  it("supports an encrypted zero-record vault payload", () => {
    const result = createPortableArchive({
      ...fixture(),
      mode: "encrypted-secrets",
      secrets: Buffer.from("empty encrypted vault archive"),
    });
    const parsed = parsePortableArchive(result.archive);
    expect(parsed.manifest.encryption?.selected_count).toBe(0);
    expect(parsed.entries.get("secrets.enc"))
      .toEqual(Buffer.from("empty encrypted vault archive"));
  });

  it("accepts empty portable collections and the exact YAML byte boundary", () => {
    const exact = Buffer.alloc(16 * 1024 * 1024, 0x61);
    const result = createPortableArchive({
      ...fixture(),
      counts: {
        services: 0,
        destinations: 0,
        credentials: 0,
        policies: 0,
        rules: 0,
        secrets: 0,
      },
      documents: {
        services: exact,
        credentials: Buffer.from("credentials: []\n"),
        policies: Buffer.from("policies: []\n"),
      },
    });
    expect(parsePortableArchive(result.archive).entries.get("services.yaml"))
      .toHaveLength(exact.byteLength);
  });

  it("rejects malformed creation inputs and limit plus one without an artifact", () => {
    const invalidCases = [
      null,
      { ...fixture(), archiveId: "not-a-uuid" },
      { ...fixture(), mode: "encrypted-secrets" as const },
      { ...fixture(), secrets: Buffer.from("unexpected") },
      {
        ...fixture(),
        counts: { ...COUNTS, services: 10_001 },
      },
      {
        ...fixture(),
        documents: {
          ...fixture().documents,
          services: Buffer.alloc((16 * 1024 * 1024) + 1),
        },
      },
    ];
    for (const input of invalidCases) {
      expect(() => createPortableArchive(input as never))
        .toThrow(PortableArchiveError);
    }
    expect(() => parsePortableArchive(null as never))
      .toThrowError(new PortableArchiveError("corrupt"));
  });

  it("rejects truncation, trailing blocks, unsafe types, and header corruption", () => {
    const archive = createPortableArchive(fixture()).archive;
    expect(() => parsePortableArchive(archive.subarray(0, archive.byteLength - 1)))
      .toThrowError(new PortableArchiveError("corrupt"));

    const tar = gunzipSync(archive);
    const trailing = gzipSync(Buffer.concat([tar, Buffer.alloc(512)]), {
      level: 9,
    });
    expect(() => parsePortableArchive(trailing))
      .toThrowError(new PortableArchiveError("corrupt"));

    const linked = Buffer.from(tar);
    linked[156] = 0x32;
    refreshChecksum(linked, 0);
    expect(() => parsePortableArchive(gzipSync(linked)))
      .toThrowError(new PortableArchiveError("corrupt"));

    const unsafe = Buffer.from(tar);
    unsafe.fill(0, 0, 100);
    unsafe.write("../manifest.yaml", 0, "ascii");
    refreshChecksum(unsafe, 0);
    expect(() => parsePortableArchive(gzipSync(unsafe)))
      .toThrowError(new PortableArchiveError("corrupt"));
  });

  it("rejects reordered, duplicate, extra, and checksum-mismatched entries", () => {
    const archive = createPortableArchive(fixture()).archive;
    const tar = gunzipSync(archive);
    const blocks = splitEntries(tar);
    const reorder = gzipSync(Buffer.concat([
      blocks[1]!,
      blocks[0]!,
      ...blocks.slice(2),
      Buffer.alloc(1024),
    ]));
    expect(() => parsePortableArchive(reorder))
      .toThrowError(new PortableArchiveError("corrupt"));

    const duplicate = gzipSync(Buffer.concat([
      blocks[0]!,
      blocks[0]!,
      ...blocks.slice(1),
      Buffer.alloc(1024),
    ]));
    expect(() => parsePortableArchive(duplicate))
      .toThrowError(new PortableArchiveError("corrupt"));

    const extra = Buffer.from(blocks[1]!);
    extra.fill(0, 0, 100);
    extra.write("extra.yaml", 0, "ascii");
    refreshChecksum(extra, 0);
    expect(() => parsePortableArchive(gzipSync(Buffer.concat([
      ...blocks,
      extra,
      Buffer.alloc(1024),
    ])))).toThrowError(new PortableArchiveError("corrupt"));

    const mismatch = Buffer.from(tar);
    const servicesOffset = blocks[0]!.byteLength + 512;
    mismatch[servicesOffset] ^= 1;
    expect(() => parsePortableArchive(gzipSync(mismatch)))
      .toThrowError(new PortableArchiveError("corrupt"));
  });
});

function fixture() {
  return {
    archiveId: ARCHIVE_ID,
    productVersion: "0.1.0-test",
    createdAtUtcMs: 1_800_000_000_000,
    mode: "credential-less" as const,
    counts: { ...COUNTS },
    documents: {
      services: Buffer.from("kind: services\nname: Café\n"),
      credentials: Buffer.from("kind: credentials\ncredentials: []\n"),
      policies: Buffer.from("kind: policies\npolicies: []\n"),
    },
  };
}

function splitEntries(tar: Buffer): Buffer[] {
  const entries: Buffer[] = [];
  let offset = 0;
  while (!tar.subarray(offset, offset + 512).every((byte) => byte === 0)) {
    const header = tar.subarray(offset, offset + 512);
    const size = Number.parseInt(
      header.subarray(124, 135).toString("ascii"),
      8,
    );
    const length = 512 + (Math.ceil(size / 512) * 512);
    entries.push(Buffer.from(tar.subarray(offset, offset + length)));
    offset += length;
  }
  return entries;
}

function refreshChecksum(tar: Buffer, offset: number): void {
  tar.fill(0x20, offset + 148, offset + 156);
  let checksum = 0;
  for (const byte of tar.subarray(offset, offset + 512)) checksum += byte;
  const octal = checksum.toString(8).padStart(7, "0");
  tar.write(octal, offset + 148, 7, "ascii");
  tar[offset + 155] = 0;
}
