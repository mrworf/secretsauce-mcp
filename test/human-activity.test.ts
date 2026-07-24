import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HumanActivityRepository } from "../src/humanActivity.js";
import { IdentityRepository } from "../src/identity/repository.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const START = 1_785_000_000_000;
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("qualifying human activity", () => {
  it("initializes from account history and coalesces monotonic writes", async () => {
    const now = { value: START };
    const worker = open(now);
    const identities = new IdentityRepository(worker, { now: () => now.value });
    const user = await identities.createLocalIdentity({
      profile: {
        email: "activity@example.org",
        givenName: "Activity",
        familyName: "User",
      },
      role: "user",
      status: "active",
    }, audit());
    const activity = new HumanActivityRepository(worker, () => now.value);
    expect(await activity.record(user.id)).toBe(false);
    now.value += 59_999;
    expect(await activity.record(user.id)).toBe(false);
    now.value += 1;
    expect(await activity.record(user.id)).toBe(true);
    now.value -= 1;
    expect(await activity.record(user.id)).toBe(false);
    expect(await worker.execute({
      run: (database) => database.read((query) => query.get<{
        activity: number;
        version: number;
      }>(`
        SELECT last_qualifying_activity_at AS activity, version
        FROM users WHERE id = ?
      `, [user.id])),
    })).toEqual({ activity: START + 60_000, version: 1 });
  });
});

function open(now: { value: number }): PersistenceWorker {
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "secretsauce-human-activity-")),
      "control.sqlite",
    ),
    productVersion: "test",
    now: () => now.value,
  });
  workers.add(worker);
  return worker;
}

function audit() {
  return {
    actor: {
      type: "local_cli" as const,
      label: "activity-fixture",
      authenticationMethod: "host_terminal",
    },
    correlationId: "req_12345678-1234-4234-8234-123456789abc",
    source: { category: "identity" },
  };
}
