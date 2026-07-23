import {
  readFileSync,
  readdirSync,
  lstatSync,
} from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { publicControlRoute, sendControlError } from "./security.js";

const MAX_INDEX_BYTES = 256 * 1024;
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_TOTAL_BYTES = 5 * 1024 * 1024;
const MAX_ASSET_COUNT = 32;
const assetNamePattern = /^[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:css|js|png|svg|woff2)$/;
const spaPathPattern = /^\/control(?:\/[a-z0-9-]+)?\/?$/;

export interface ControlWebAsset {
  body: Buffer;
  contentType: string;
}

export interface ControlWebAssets {
  index: ControlWebAsset;
  assets: ReadonlyMap<string, ControlWebAsset>;
}

export function loadControlWebAssets(
  directory = resolve("dist/control-web"),
): ControlWebAssets {
  try {
    const index = loadFile(`${directory}/index.html`, "text/html; charset=utf-8", MAX_INDEX_BYTES);
    const assetEntries = readdirSync(`${directory}/assets`, { withFileTypes: true });
    if (assetEntries.length < 1 || assetEntries.length > MAX_ASSET_COUNT) throw new Error("asset count");
    const assets = new Map<string, ControlWebAsset>();
    let totalBytes = 0;
    for (const entry of assetEntries) {
      if (!entry.isFile() || !assetNamePattern.test(entry.name)) throw new Error("asset name");
      const contentType = contentTypeFor(entry.name);
      const asset = loadFile(`${directory}/assets/${entry.name}`, contentType, MAX_ASSET_BYTES);
      totalBytes += asset.body.byteLength;
      if (totalBytes > MAX_ASSET_TOTAL_BYTES) throw new Error("asset total");
      assets.set(entry.name, asset);
    }
    const html = index.body.toString("utf8");
    const referenceText = [
      html,
      ...[...assets.entries()]
        .filter(([name]) => name.endsWith(".js") || name.endsWith(".css"))
        .map(([, asset]) => asset.body.toString("utf8")),
    ].join("\n");
    for (const name of assets.keys()) {
      if (!referenceText.includes(name)) throw new Error("unreferenced asset");
    }
    if (/<script(?![^>]*\bsrc=)/i.test(html) || /<style[\s>]/i.test(html)) {
      throw new Error("inline executable content");
    }
    return { index, assets };
  } catch {
    throw new Error("Control web assets are unavailable.");
  }
}

export function installControlWebRoutes(
  application: FastifyInstance,
  webAssets: ControlWebAssets,
): void {
  application.get("/control", {
    config: publicControlRoute(),
  }, async (_request, reply) => reply.redirect("/control/"));
  application.get<{ Params: { asset: string } }>("/control/assets/:asset", {
    config: publicControlRoute("immutable"),
  }, async (request, reply) => {
    const asset = webAssets.assets.get(request.params.asset);
    if (asset === undefined) {
      sendControlError(reply, request.id, 404, "not_found", "Not found.");
      return;
    }
    return reply.type(asset.contentType).send(asset.body);
  });
  application.get<{ Params: { "*": string } }>("/control/*", {
    config: publicControlRoute(),
  }, async (request, reply) => {
    const pathname = request.url.split("?", 1)[0] ?? "";
    if (!spaPathPattern.test(pathname)) {
      sendControlError(reply, request.id, 404, "not_found", "Not found.");
      return;
    }
    return reply.type(webAssets.index.contentType).send(webAssets.index.body);
  });
}

function loadFile(path: string, contentType: string, maximumBytes: number): ControlWebAsset {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.size < 1 || stats.size > maximumBytes) throw new Error("file bounds");
  const body = readFileSync(path);
  if (body.byteLength !== stats.size) throw new Error("file changed");
  return { body, contentType };
}

function contentTypeFor(name: string): string {
  if (name.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (name.endsWith(".css")) return "text/css; charset=utf-8";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".woff2")) return "font/woff2";
  throw new Error("unsupported asset type");
}
