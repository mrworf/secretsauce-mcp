import { Worker } from "node:worker_threads";
import { z } from "zod";
import { configError, configValidationError, type ConfigPath } from "./errors.js";
import { loadYamlConfig, validationDiagnostics } from "./yamlConfig.js";

const MAX_PATTERNS = 256;
const MAX_PATTERN_LENGTH = 512;
const MAX_CANDIDATE_LENGTH = 256;
const idPattern = /^[a-z0-9][a-z0-9._-]*$/;

export interface SensitiveNamePattern {
  id: string;
  regex: string;
}

export interface SensitiveNameConfig {
  version: 1;
  mode: "extend" | "replace";
  allowPatterns: string[];
  patterns: SensitiveNamePattern[];
}

const regexSource = z.string().min(1).max(MAX_PATTERN_LENGTH);
const schema = z.object({
  version: z.literal(1),
  mode: z.enum(["extend", "replace"]).default("extend"),
  allow_patterns: z.array(regexSource).max(MAX_PATTERNS).default([]),
  patterns: z.array(z.object({
    id: z.string().regex(idPattern).max(64),
    regex: regexSource,
  }).strict()).max(MAX_PATTERNS).default([]),
}).strict();

export const DEFAULT_SENSITIVE_NAMES_CONFIG_PATH = "/config/sensitive-names.yaml";

export function loadSensitiveNameConfig(
  path = process.env.SENSITIVE_NAMES_CONFIG_PATH ?? DEFAULT_SENSITIVE_NAMES_CONFIG_PATH,
): SensitiveNameConfig {
  return loadYamlConfig(path, "sensitive-name config", validateSensitiveNameConfig);
}

export function validateSensitiveNameConfig(raw: unknown): SensitiveNameConfig {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const diagnostics = validationDiagnostics(result.error.issues);
    throw configError(`Invalid sensitive-name config: ${diagnostics.map((issue) => issue.detail).join("; ")}`, diagnostics);
  }
  const ids = result.data.patterns.map((pattern) => pattern.id);
  const duplicateIndex = ids.findIndex((id, index) => ids.indexOf(id) !== index);
  if (duplicateIndex >= 0) throw configValidationError("Invalid sensitive-name config: pattern ids must be unique", ["patterns", duplicateIndex, "id"]);
  result.data.allow_patterns.forEach((source, index) => compileRegex(source, ["allow_patterns", index]));
  result.data.patterns.forEach((pattern, index) => compileRegex(pattern.regex, ["patterns", index, "regex"]));
  return {
    version: 1,
    mode: result.data.mode,
    allowPatterns: result.data.allow_patterns,
    patterns: result.data.patterns,
  };
}

export function resolveSensitiveNameConfig(
  configured: SensitiveNameConfig,
  defaults: SensitiveNameConfig,
): SensitiveNameConfig {
  if (configured.mode === "replace") return configured;
  const patterns = new Map(defaults.patterns.map((pattern) => [pattern.id, pattern]));
  for (const pattern of configured.patterns) patterns.set(pattern.id, pattern);
  return {
    version: 1,
    mode: "extend",
    allowPatterns: [...new Set([...defaults.allowPatterns, ...configured.allowPatterns])],
    patterns: [...patterns.values()],
  };
}

let batchSlots=0;
export class SensitiveNameMatcher {
  private readonly allows: RegExp[];
  private readonly patterns: Array<{ id: string; regex: RegExp }>;

  constructor(readonly config: SensitiveNameConfig) {
    this.allows = config.allowPatterns.map((source) => compileRegex(source));
    this.patterns = config.patterns.map((pattern) => ({ id: pattern.id, regex: compileRegex(pattern.regex) }));
  }

  async matchBatch(names: string[]): Promise<Map<string,string[]>> {
    if(names.length>10000||batchSlots>=4)throw new Error('Sensitive-name matching capacity exceeded');
    const skipped=new Map(names.filter(name=>name.length===0||name.length>MAX_CANDIDATE_LENGTH).map(name=>[name,[] as string[]]));
    const eligible=names.filter(name=>name.length>0&&name.length<=MAX_CANDIDATE_LENGTH);if(!eligible.length)return skipped;
    batchSlots++;
    try{return await new Promise<Map<string,string[]>>((resolve,reject)=>{
      const source=`const {parentPort,workerData}=require('node:worker_threads');const normalizeSensitiveName=${normalizeSensitiveName.toString()};try{const allows=workerData.config.allowPatterns.map(s=>new RegExp(s,'i')),patterns=workerData.config.patterns.map(p=>({id:p.id,regex:new RegExp(p.regex,'i')}));parentPort.postMessage(workerData.names.map(name=>{if(name.length===0||name.length>${MAX_CANDIDATE_LENGTH})return [name,[]];const n=normalizeSensitiveName(name);return [name, n.length===0||allows.some(p=>p.test(n))?[]:patterns.filter(p=>p.regex.test(n)).map(p=>'gateway:sensitive-name:'+p.id)];}));}catch{parentPort.postMessage({error:true});}`;
      const worker=new Worker(source,{eval:true,workerData:{config:this.config,names:eligible},resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8}});
      const timer=setTimeout(async()=>{await worker.terminate();reject(new Error('Sensitive-name matching deadline exceeded'));},1000);
      worker.once('message',async result=>{clearTimeout(timer);await worker.terminate();if(!Array.isArray(result)){reject(new Error('Sensitive-name matching failed'));return;}resolve(new Map([...skipped,...result]));});
      worker.once('error',async()=>{clearTimeout(timer);await worker.terminate();reject(new Error('Sensitive-name matching failed'));});
    });}finally{batchSlots--;}
  }

  match(name: string): string[] {
    if (name.length === 0 || name.length > MAX_CANDIDATE_LENGTH) return [];
    const normalized = normalizeSensitiveName(name);
    if (normalized.length === 0 || this.allows.some((pattern) => pattern.test(normalized))) return [];
    return this.patterns.filter((pattern) => pattern.regex.test(normalized)).map((pattern) => `gateway:sensitive-name:${pattern.id}`);
  }
}

export function normalizeSensitiveName(name: string): string {
  return name.trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function compileRegex(source: string, path?: ConfigPath): RegExp {
  try {
    return new RegExp(source, "i");
  } catch {
    if (path !== undefined) throw configValidationError("Invalid sensitive-name config: regex must compile", path);
    throw configError("Invalid sensitive-name config: regex must compile");
  }
}
