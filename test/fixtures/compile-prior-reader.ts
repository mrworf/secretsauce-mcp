import { readFileSync } from "node:fs";
import { transformWithOxc } from "vite";

export async function compilePriorReader(filename: string): Promise<string> {
  // The pinned sources are stored as .ts.txt. Select the original TypeScript loader.
  const source = readFileSync(filename, "utf8");
  const result = await transformWithOxc(source, filename.replace(/\.txt$/, ""), { target: "es2022" });
  return result.code;
}
