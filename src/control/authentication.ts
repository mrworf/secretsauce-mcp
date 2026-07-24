import type { FastifyRequest } from "fastify";
import type { ControlRole } from "./permissions.js";

export type ControlAuthenticationMethod =
  | "browser_session"
  | "restricted_session"
  | "api_key"
  | "local_cli";

export interface ControlAuthenticationContext {
  method: ControlAuthenticationMethod;
  principalId: string;
  role: ControlRole;
  apiKey?: {
    nickname: string;
    lastFour: string;
    serviceId?: string;
  };
}

export interface ControlAuthenticator {
  authenticate(request: FastifyRequest): Promise<ControlAuthenticationContext | undefined>;
  verifyCsrf(
    context: ControlAuthenticationContext,
    proof: string,
    request: FastifyRequest,
  ): Promise<boolean>;
}

export interface ControlApiKeyActivityRecorder {
  recordControlActivity(input: {
    apiKeyId: string;
    action: string;
    outcome: "allow" | "deny" | "error";
    targetId?: string;
    requestId: string;
    failureCode?: string;
  }): Promise<void>;
}

export const denyControlAuthentication: ControlAuthenticator = {
  authenticate: async () => undefined,
  verifyCsrf: async () => false,
};

const requestAuthentication = new WeakMap<FastifyRequest, ControlAuthenticationContext>();

export function bindControlAuthentication(
  request: FastifyRequest,
  context: ControlAuthenticationContext,
): void {
  requestAuthentication.set(request, context);
}

export function controlAuthentication(
  request: FastifyRequest,
): ControlAuthenticationContext | undefined {
  return requestAuthentication.get(request);
}
