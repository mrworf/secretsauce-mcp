import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { expect, test, type Locator } from "@playwright/test";
import {
  parseTotpEnrollmentUri,
  totpCode,
} from "../../src/identity/totp.js";

const CONTROL_ORIGIN = "http://localhost:8081";
const COMPOSE_FILE = "docker-compose.local.yaml";
const ENROLLMENT_LINE =
  /SECRETSAUCE INITIAL ENROLLMENT SECRET: ([A-Za-z0-9_-]{32}) /g;

test("runs the clean Docker browser enrollment and login journey", async ({
  page,
}) => {
  const project = requiredProject();
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.name));

  await waitForGatewayLiveness();
  await page.goto("/");
  await expect(page).toHaveURL(`${CONTROL_ORIGIN}/control/`);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Setting up SecretSauce");
  await expect(page.locator("body")).not.toContainText("setup prerequisites");

  browserErrors.length = 0;
  const setupResponse = await page.goto("/control/setup");
  expect(setupResponse?.status()).toBe(200);
  expect(setupResponse?.headers()["content-security-policy"]).toContain(
    "script-src 'self'",
  );
  await expect(
    page.getByRole("heading", { name: "Setting up SecretSauce" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ready for secure enrollment" }),
  ).toBeVisible({ timeout: 120_000 });
  expect(browserErrors).toEqual([]);
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");

  const enrollmentSecret = await readEnrollmentSecret(project);
  const email = "browser-admin@example.org";
  const password = `Browser-${randomBytes(18).toString("base64url")}!`;

  await page.goto("/control/enroll");
  await page.getByLabel("Email").fill(email);
  await setSensitiveValue(
    page.getByLabel("Enrollment code"),
    "invalid-enrollment-code",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Enrollment details are invalid or expired. Try again.",
  );
  await expect(page.getByLabel("Enrollment code")).toHaveValue("");

  await setSensitiveValue(page.getByLabel("Enrollment code"), enrollmentSecret);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a password" }),
  ).toBeVisible();
  await page.getByLabel("Given name").fill("Browser");
  await page.getByLabel("Family name").fill("Administrator");
  await setSensitiveValue(page.getByLabel("New password"), password);
  await setSensitiveValue(page.getByLabel("Confirm password"), password);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Set up an authenticator" }),
  ).toBeVisible();
  const enrollmentUri = await page
    .getByRole("link", { name: "Open authenticator setup" })
    .getAttribute("href");
  if (enrollmentUri === null) {
    throw new Error("Authenticator enrollment data was unavailable.");
  }
  const parsed = parseTotpEnrollmentUri(enrollmentUri);
  try {
    await setSensitiveValue(
      page.getByLabel("6-digit code"),
      totpCode(parsed.seed, Date.now()),
    );
    await page.getByRole("button", { name: "Complete enrollment" }).click();
    await expect(page).toHaveURL(/\/control\/login\?enrollment=complete$/);
    await expect(page.getByText("Enrollment complete.")).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await setSensitiveValue(page.getByLabel("Password"), password);
    await setSensitiveValue(
      page.getByLabel("Authenticator code"),
      totpCode(parsed.seed, Date.now() + 30_000),
    );
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
      timeout: 30_000,
    });

    const brand = page.getByRole("link", { name: "SecretSauce control overview" });
    await expect(brand).toBeVisible();
    const brandPresentation = await brand.evaluate((element) => {
      const image = element.querySelector("img");
      if (!(image instanceof HTMLImageElement)) throw new Error("Brand image is unavailable.");
      const surface = element.getBoundingClientRect();
      const mark = image.getBoundingClientRect();
      return {
        background: getComputedStyle(element).backgroundColor,
        contained: mark.top >= surface.top && mark.bottom <= surface.bottom &&
          mark.left >= surface.left && mark.right <= surface.right,
      };
    });
    expect(brandPresentation).toEqual({ background: "rgb(255, 255, 255)", contained: true });

    await page.getByRole("link", { name: "Services" }).first().click();
    await expect(page.getByRole("heading", { name: "Service drafts" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\bslug\b/i);
    await page.getByRole("button", { name: "New service" }).click();
    const serviceForm = page.locator("form").filter({
      has: page.getByRole("heading", { name: "Create a non-routable draft" }),
    });
    await serviceForm.getByLabel("Service name").fill("Browser managed API");
    await serviceForm.getByRole("button", { name: "Create service draft" }).click();
    await expect(page.getByRole("heading", { name: "Browser managed API" })).toBeVisible();

    await page.getByRole("button", { name: "Add destination" }).click();
    const destinationForm = page.locator("form").filter({
      has: page.getByRole("heading", { name: "New destination" }),
    });
    await destinationForm.getByLabel("Base URL").fill("https://api.example.org/v1/");
    await expect(destinationForm).toContainText(
      "Requests are limited to HTTPS on api.example.org:443.",
    );
    const tls = destinationForm.getByRole("checkbox", { name: /Verify TLS certificates/i });
    const tlsPresentation = await tls.evaluate((element) => {
      const input = element.getBoundingClientRect();
      const control = element.closest("label")?.getBoundingClientRect();
      return { width: input.width, height: input.height, controlHeight: control?.height ?? 0 };
    });
    expect(tlsPresentation.width).toBeLessThanOrEqual(24);
    expect(tlsPresentation.height).toBeLessThanOrEqual(24);
    expect(tlsPresentation.controlHeight).toBeGreaterThanOrEqual(44);
    await destinationForm.getByText("Advanced routing limits").click();
    await expect(destinationForm.getByLabel("Rule 1 value")).toHaveValue("api.example.org");
    await expect(destinationForm.getByLabel("Port 1")).toHaveValue("443");
    await destinationForm.getByRole("button", { name: "Create destination" }).click();
    await expect(page.getByText("Destination added to the draft.")).toBeVisible();

    const owner = await page.getByLabel("Eligible administrator");
    await expect(owner).toContainText("You — Browser Administrator");
    await page.getByRole("button", { name: "Assign administrator" }).click();
    await expect(page.getByText("Administrator assigned.")).toBeVisible();
    await page.getByRole("button", { name: "Validate draft" }).click();
    await expect(page.getByText("Draft is publishable")).toBeVisible();
    await page.getByRole("button", { name: "Publish draft" }).click();
    await expect(page.getByText("Published draft current")).toBeVisible();
  } finally {
    parsed.seed.fill(0);
  }
});

async function setSensitiveValue(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((element, nextValue) => {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error("Sensitive input is unavailable.");
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (setter === undefined) throw new Error("Sensitive input is unavailable.");
    setter.call(element, nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function waitForGatewayLiveness(): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:8080/health/live", {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 200) return;
    } catch {
      // The disposable topology is still starting.
    }
    await delay(500);
  }
  throw new Error("The disposable gateway did not become live.");
}

async function readEnrollmentSecret(project: string): Promise<string> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = spawnSync("docker", [
      "compose",
      "-p",
      project,
      "-f",
      COMPOSE_FILE,
      "logs",
      "--no-color",
      "secretsauce",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 2 * 1024 * 1024,
      timeout: 10_000,
    });
    const matches = [...(result.stdout ?? "").matchAll(ENROLLMENT_LINE)];
    if (matches.length > 1) {
      throw new Error("The application emitted enrollment authority more than once.");
    }
    const value = matches[0]?.[1];
    if (value !== undefined) return value;
    await delay(500);
  }
  throw new Error("The application did not emit enrollment authority.");
}

function requiredProject(): string {
  const value = process.env.SECRETSAUCE_E2E_COMPOSE_PROJECT;
  if (value === undefined || !/^secretsauce-e2e-[a-z0-9-]+$/.test(value)) {
    throw new Error("The disposable Compose project is unavailable.");
  }
  return value;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
