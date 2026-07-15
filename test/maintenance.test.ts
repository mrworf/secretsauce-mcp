import { describe, expect, it, vi } from "vitest";
import { registerMaintenanceTask, startMaintenance } from "../src/maintenance.js";
import { registryConfig } from "./helpers.js";

describe("state maintenance", () => {
  it("runs registered tasks on schedule and stops them on shutdown", () => {
    vi.useFakeTimers();
    try {
      const config = registryConfig();
      let calls = 0;
      registerMaintenanceTask(config, () => { calls += 1; });
      const stop = startMaintenance(config);
      vi.advanceTimersByTime(config.limits.stateSweepIntervalMs);
      expect(calls).toBe(1);
      stop();
      vi.advanceTimersByTime(config.limits.stateSweepIntervalMs);
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
