import { Buffer } from "node:buffer";
import {
  BackupCoordinatorError,
  PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
  type PortableBackupCoordinator,
} from "../backupCoordinator.js";
import { ControlContractError } from "./contracts.js";
import {
  type ControlRouteRegistry,
  defineControlRoute,
} from "./routeRegistry.js";
import { z } from "./zod.js";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const ARCHIVE_FILENAME = "secretsauce-portable-backup.tar.gz";
const binaryArchiveSchema = z.custom<Buffer>(
  (value) => Buffer.isBuffer(value),
).meta({
  id: "PortableBackupArchive",
  description: "Bounded gzip-compressed portable backup archive.",
});
const passphrase = z.string().superRefine((value, context) => {
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < 12 || bytes > 1_024) {
    context.addIssue({
      code: "custom",
      message: "Passphrase must contain 12 to 1,024 UTF-8 bytes.",
    });
  }
});
const interactiveBody = z.object({
  include_secrets: z.boolean(),
  acknowledgement: z.literal(PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT),
  passphrase: passphrase.optional(),
}).strict().superRefine((value, context) => {
  if (value.include_secrets !== (value.passphrase !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["passphrase"],
      message: value.include_secrets
        ? "Passphrase is required for encrypted credential export."
        : "Passphrase is not permitted for credential-less export.",
    });
  }
});
const programmaticBody = z.object({
  acknowledgement: z.literal(PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT),
}).strict();

export function registerBackupRoutes(
  registry: ControlRouteRegistry,
  coordinator?: PortableBackupCoordinator,
): void {
  registry.register(defineControlRoute({
    id: "backups.create_interactive",
    method: "POST",
    path: "/api/v2/backups/interactive",
    summary: "Create a stepped-up portable backup",
    tags: ["Backups"],
    authentication: ["browser_session"],
    expandApiKeyAuthentication: false,
    permission: "create_portable_backup",
    stepUp: "always",
    schemas: {
      body: interactiveBody,
      response: binaryArchiveSchema,
    },
    rateLimit: "management",
    auditAction: "backup.export",
    secretFields: ["/passphrase"],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    binaryResponse: {
      contentType: "application/gzip",
      filename: ARCHIVE_FILENAME,
      maxBytes: MAX_ARCHIVE_BYTES,
    },
    handler: async ({
      authentication,
      body,
      requestId,
      stepUpProof,
    }) => {
      if (
        coordinator === undefined
        || authentication === undefined
        || stepUpProof === undefined
      ) throw unavailable();
      const passphraseBytes = body.passphrase === undefined
        ? undefined
        : Buffer.from(body.passphrase, "utf8");
      try {
        const result = await coordinator.create({
          actor: authentication,
          includeSecrets: body.include_secrets,
          acknowledgement: body.acknowledgement,
          correlationId: requestId,
          ...(passphraseBytes === undefined
            ? {}
            : { passphrase: passphraseBytes }),
          stepUpProof,
        });
        return { data: result.archive };
      } catch (error) {
        throw mapBackupError(error);
      } finally {
        passphraseBytes?.fill(0);
      }
    },
  }));

  registry.register(defineControlRoute({
    id: "backups.create_programmatic",
    method: "POST",
    path: "/api/v2/backups/programmatic",
    summary: "Create a credential-less automation backup",
    tags: ["Backups"],
    authentication: ["api_key"],
    permission: "create_portable_backup",
    stepUp: "none",
    schemas: {
      body: programmaticBody,
      response: binaryArchiveSchema,
    },
    rateLimit: "management",
    auditAction: "backup.export",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    binaryResponse: {
      contentType: "application/gzip",
      filename: ARCHIVE_FILENAME,
      maxBytes: MAX_ARCHIVE_BYTES,
    },
    handler: async ({ authentication, body, requestId }) => {
      if (coordinator === undefined || authentication === undefined) {
        throw unavailable();
      }
      try {
        const result = await coordinator.create({
          actor: authentication,
          includeSecrets: false,
          acknowledgement: body.acknowledgement,
          correlationId: requestId,
        });
        return { data: result.archive };
      } catch (error) {
        throw mapBackupError(error);
      }
    },
  }));
}

function mapBackupError(error: unknown): ControlContractError {
  if (!(error instanceof BackupCoordinatorError)) return unavailable();
  if (error.code === "invalid") {
    return new ControlContractError(
      400,
      "invalid_request",
      "Backup request is invalid.",
    );
  }
  if (error.code === "forbidden") {
    return new ControlContractError(
      403,
      "forbidden",
      "The operation is not permitted.",
    );
  }
  if (error.code === "rate_limited" || error.code === "busy") {
    return new ControlContractError(
      429,
      "rate_limited",
      "Backup generation is temporarily limited.",
    );
  }
  if (error.code === "vault_unavailable") return unavailable();
  return new ControlContractError(
    500,
    "internal_error",
    "Backup generation failed.",
  );
}

function unavailable(): ControlContractError {
  return new ControlContractError(
    503,
    "vault_unavailable",
    "Backup generation is unavailable.",
  );
}
