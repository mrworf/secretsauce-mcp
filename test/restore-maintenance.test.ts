import { describe, expect, it, vi } from "vitest";
import {
  RestoreMaintenanceError,
  RestoreMaintenanceGate,
} from "../src/restoreMaintenance.js";

describe("restore maintenance gate", () => {
  it("drains existing work, rejects new work, and exclusively releases once", async () => {
    const gate = new RestoreMaintenanceGate();
    const first = gate.acquireOrdinary();
    const second = gate.acquireOrdinary();
    expect(gate.active).toBe(2);

    const exclusive = gate.acquireExclusive(1_000);
    expect(gate.phase).toBe("draining");
    expect(() => gate.acquireOrdinary())
      .toThrowError(new RestoreMaintenanceError("maintenance"));
    first.release();
    first.release();
    expect(gate.active).toBe(1);
    second.release();

    const lease = await exclusive;
    expect(gate.phase).toBe("exclusive");
    expect(() => gate.acquireOrdinary())
      .toThrowError(new RestoreMaintenanceError("maintenance"));
    lease.release();
    lease.release();
    expect(gate.phase).toBe("open");
    expect(gate.active).toBe(0);
  });

  it("times out before exclusive work and reopens ordinary traffic", async () => {
    vi.useFakeTimers();
    try {
      const gate = new RestoreMaintenanceGate();
      const ordinary = gate.acquireOrdinary();
      const exclusive = gate.acquireExclusive(30_000);
      const rejected = expect(exclusive)
        .rejects.toEqual(new RestoreMaintenanceError("timeout"));
      await vi.advanceTimersByTimeAsync(30_000);
      await rejected;
      expect(gate.phase).toBe("open");
      ordinary.release();
      const next = gate.acquireOrdinary();
      next.release();
    } finally {
      vi.useRealTimers();
    }
  });

  it("wraps jobs and releases their lease after positive or negative completion", async () => {
    const gate = new RestoreMaintenanceGate();
    await expect(gate.runOrdinary(async () => 42)).resolves.toBe(42);
    await expect(gate.runOrdinary(async () => {
      throw new Error("failed");
    })).rejects.toThrow("failed");
    expect(gate.active).toBe(0);

    const exclusive = await gate.acquireExclusive();
    await expect(gate.runOrdinary(async () => undefined))
      .rejects.toEqual(new RestoreMaintenanceError("maintenance"));
    exclusive.release();
  });

  it("marks durable maintenance only after drain and fails before exclusive work", async () => {
    const gate = new RestoreMaintenanceGate();
    const ordinary = gate.acquireOrdinary();
    const mark = vi.fn(async () => undefined);
    const acquiring = gate.acquireExclusive(1_000, mark);
    expect(mark).not.toHaveBeenCalled();
    ordinary.release();
    const exclusive = await acquiring;
    expect(mark).toHaveBeenCalledOnce();
    exclusive.release();

    await expect(gate.acquireExclusive(1_000, async () => {
      throw new Error("durable state unavailable");
    })).rejects.toThrow("durable state unavailable");
    expect(gate.phase).toBe("open");
    const reopened = gate.acquireOrdinary();
    reopened.release();
  });
});
