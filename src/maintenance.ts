import type { GatewayConfig } from "./types.js";

type MaintenanceTask = (now: number) => void;
interface MaintenanceState { tasks: Set<MaintenanceTask>; timer: NodeJS.Timeout | undefined }
const states = new WeakMap<GatewayConfig, MaintenanceState>();

export function registerMaintenanceTask(config: GatewayConfig, task: MaintenanceTask): void {
  stateFor(config).tasks.add(task);
}

export function runMaintenance(config: GatewayConfig, now = Date.now()): void {
  for (const task of stateFor(config).tasks) task(now);
}

export function startMaintenance(config: GatewayConfig): () => void {
  const state = stateFor(config);
  if (state.timer === undefined) {
    state.timer = setInterval(() => runMaintenance(config), config.limits.stateSweepIntervalMs);
    state.timer.unref();
  }
  return () => {
    if (state.timer !== undefined) clearInterval(state.timer);
    state.timer = undefined;
  };
}

function stateFor(config: GatewayConfig): MaintenanceState {
  let state = states.get(config);
  if (state === undefined) {
    state = { tasks: new Set(), timer: undefined };
    states.set(config, state);
  }
  return state;
}
