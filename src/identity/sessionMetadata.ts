import { coarseClientNetwork } from "../clientSource.js";

export interface BrowserSessionMetadata {
  authenticationMethod: "local_password_totp" | "oidc";
  deviceFamily: string | null;
  coarseSource: string | null;
}

export function browserSessionMetadata(input: {
  authenticationMethod: BrowserSessionMetadata["authenticationMethod"];
  source?: unknown;
  userAgent?: unknown;
}): BrowserSessionMetadata {
  return {
    authenticationMethod: input.authenticationMethod,
    deviceFamily: deviceFamily(input.userAgent),
    coarseSource: coarseSource(input.source),
  };
}

function deviceFamily(value: unknown): string | null {
  if (
    typeof value !== "string"
    || value.length < 1
    || Buffer.byteLength(value, "utf8") > 1_024
    || /[\u0000-\u001f\u007f]/.test(value)
  ) return null;
  const browser = /\bEdg(?:A|iOS)?\//.test(value)
    ? "Edge"
    : /\b(?:CriOS|Chrome)\//.test(value)
      ? "Chrome"
      : /\bFxiOS\//.test(value) || /\bFirefox\//.test(value)
        ? "Firefox"
        : /\bSafari\//.test(value) && /\bVersion\//.test(value)
          ? "Safari"
          : null;
  if (browser === null) return null;
  const device = /\b(?:Mobile|Android|iPhone|iPad)\b/i.test(value)
    ? "mobile"
    : "desktop";
  return `${browser} on ${device}`;
}

function coarseSource(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    return null;
  }
  try {
    return coarseClientNetwork(value);
  } catch {
    return null;
  }
}
