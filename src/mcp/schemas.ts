import { z } from "zod";

export const emptyInputValidator = z.strictObject({});
export const gatewayServiceReferencesInputValidator = z.strictObject({
  service: z.string(),
  destination: z.string().optional(),
  access_ids: z.array(z.string()),
  reason: z.string(),
});
export const describeServicePolicyInputValidator = z.strictObject({ service: z.string() });
export const serviceRequestInputValidator = z.strictObject({
  service: z.string(),
  destination: z.string().optional(),
  method: z.string(),
  path: z.string().optional(),
  url: z.string().optional(),
  service_reference: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  query: z.record(z.string(), z.unknown()).optional(),
  body: z.unknown().optional(),
  reason: z.string(),
});
export const explainDenialInputValidator = z.strictObject({ request_id: z.string() });

const destinationOutputValidator = z.strictObject({
  id: z.string(),
  base_url_hint: z.string(),
  tls_verify: z.boolean(),
});
const accessMethodOutputValidator = z.strictObject({
  id: z.string(),
  usage_hint: z.string(),
});

export const errorOutputValidator = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    request_id: z.string().optional(),
  }),
});

export const listServicesOutputValidator = z.strictObject({
  services: z.array(z.strictObject({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    api_docs_url: z.string().optional(),
    destinations: z.array(destinationOutputValidator),
    access_methods: z.array(accessMethodOutputValidator),
    policy_summary: z.string(),
  })),
});

export const gatewayServiceReferencesOutputValidator = z.strictObject({
  references: z.array(z.strictObject({
    access_id: z.string(),
    reference: z.string(),
    usage_hint: z.string(),
    expires_at: z.string(),
    exportable: z.literal(false),
    usable_outside_gateway: z.literal(false),
    reveals_protected_value: z.literal(false),
  })),
});

const binaryResponsePolicyOutputValidator = z.strictObject({
  scan: z.boolean(),
  max_size_bytes: z.number().int().nonnegative().nullable(),
});
const policyRuleOutputValidator = z.strictObject({
  id: z.string(),
  effect: z.enum(["allow", "deny"]),
  priority: z.number(),
  methods: z.array(z.string()),
  hosts: z.array(z.string()),
  paths: z.array(z.string()),
  reason: z.string().optional(),
  binary_response: binaryResponsePolicyOutputValidator,
});

export const describeServicePolicyOutputValidator = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  api_docs_url: z.string().optional(),
  destinations: z.array(destinationOutputValidator),
  access_methods: z.array(accessMethodOutputValidator),
  policy: z.strictObject({
    mode: z.enum(["allow", "deny"]),
    rules: z.array(policyRuleOutputValidator),
  }),
});

export const serviceRequestOutputValidator = z.strictObject({
  request_id: z.string(),
  status_code: z.number().int(),
  headers: z.record(z.string(), z.string()),
  // Downstream response bodies are intentionally opaque to the MCP contract.
  body: z.unknown(),
  body_encoding: z.enum(["utf8", "mcp_blob"]),
  body_size_bytes: z.number().int().nonnegative(),
  body_sha256: z.string(),
  secret_tokenized: z.boolean(),
  secret_tokenization_count: z.number().int().nonnegative(),
  tls: z.strictObject({ verify: z.boolean() }),
  truncated: z.boolean(),
});

export const explainDenialOutputValidator = z.strictObject({
  request_id: z.string(),
  reason: z.string(),
  matched_rule: z.string().optional(),
  policy_mode: z.enum(["allow", "deny"]),
  suggestion: z.string().optional(),
});

export function advertisedSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
}

export const emptyInputSchema = advertisedSchema(emptyInputValidator);
export const gatewayServiceReferencesInputSchema = advertisedSchema(gatewayServiceReferencesInputValidator);
export const describeServicePolicyInputSchema = advertisedSchema(describeServicePolicyInputValidator);
export const serviceRequestInputSchema = advertisedSchema(serviceRequestInputValidator);
export const explainDenialInputSchema = advertisedSchema(explainDenialInputValidator);

export const errorOutputSchema = advertisedSchema(errorOutputValidator);
export const listServicesOutputSchema = advertisedSchema(listServicesOutputValidator);
export const gatewayServiceReferencesOutputSchema = advertisedSchema(gatewayServiceReferencesOutputValidator);
export const describeServicePolicyOutputSchema = advertisedSchema(describeServicePolicyOutputValidator);
export const serviceRequestOutputSchema = advertisedSchema(serviceRequestOutputValidator);
export const explainDenialOutputSchema = advertisedSchema(explainDenialOutputValidator);
