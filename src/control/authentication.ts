import type { FastifyRequest } from "fastify";

export type ControlAuthenticationMethod = "browser_session" | "api_key" | "local_cli";

export interface ControlAuthenticationContext {
  method: ControlAuthenticationMethod;
  principalId: string;
  role: "user" | "admin" | "superadmin" | "service" | "all_services" | "system";
}

export interface ControlAuthenticator {
  authenticate(request: FastifyRequest): Promise<ControlAuthenticationContext | undefined>;
  verifyCsrf(
    context: ControlAuthenticationContext,
    proof: string,
    request: FastifyRequest,
  ): Promise<boolean>;
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
