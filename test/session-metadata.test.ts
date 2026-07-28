import { describe, expect, it } from "vitest";
import { coarseClientNetwork } from "../src/clientSource.js";
import { browserSessionMetadata } from "../src/identity/sessionMetadata.js";

describe("privacy-safe browser session metadata", () => {
  it("derives bounded device families and coarse canonical networks", () => {
    expect(coarseClientNetwork("192.0.2.129")).toBe("192.0.2.0/24");
    expect(coarseClientNetwork("2001:db8:abcd:1234::7"))
      .toBe("2001:db8:abcd::/48");
    expect(browserSessionMetadata({
      authenticationMethod: "local_password_totp",
      source: "192.0.2.129",
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    })).toEqual({
      authenticationMethod: "local_password_totp",
      deviceFamily: "Chrome on desktop",
      coarseSource: "192.0.2.0/24",
    });
    expect(browserSessionMetadata({
      authenticationMethod: "oidc",
      source: "2001:db8:abcd:1234::7",
      userAgent:
        "Mozilla/5.0 (iPhone) AppleWebKit/605.1 Version/17.0 Mobile/15 Safari/604.1",
    })).toEqual({
      authenticationMethod: "oidc",
      deviceFamily: "Safari on mobile",
      coarseSource: "2001:db8:abcd::/48",
    });
  });

  it("maps malformed, oversized, and unrecognized inputs to unknown", () => {
    expect(browserSessionMetadata({
      authenticationMethod: "oidc",
      source: "not-an-address",
      userAgent: `<script>alert(1)</script>`,
    })).toMatchObject({ deviceFamily: null, coarseSource: null });
    expect(browserSessionMetadata({
      authenticationMethod: "oidc",
      source: ["192.0.2.1"],
      userAgent: "Chrome/126.0\u0000injected",
    })).toMatchObject({ deviceFamily: null, coarseSource: null });
    expect(browserSessionMetadata({
      authenticationMethod: "oidc",
      source: "192.0.2.1",
      userAgent: "x".repeat(1_025),
    })).toMatchObject({ deviceFamily: null, coarseSource: "192.0.2.0/24" });
  });
});
