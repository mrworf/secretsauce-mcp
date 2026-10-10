import { normalizePath,assertUnambiguousPathEncoding } from './urlValidation.js';
/** Translate a guided literal prefix into the existing regex policy contract. */
export function literalPathPrefix(prefix: string): string {
  return '^' + Array.from(prefix, character => '\\^$.*+?()[]{}|'.includes(character) ? '\\' + character : character).join('');
}

/** Exact canonical path: terminal anchor prevents prefix matches. */
export function literalExactPath(path: string): string { return literalPathPrefix(path) + '$'; }

/** Guided matching accepts only the exact canonical path execution will evaluate. */
export function canonicalPathPattern(path:string,mode:'exact'|'prefix'):string {
  if(!path.startsWith('/')||path.startsWith('//')||/[?#\\]/.test(path))throw new Error('Use an absolute canonical path without query, fragment or backslash.');
  assertUnambiguousPathEncoding(path);
  if(new URL(path,'https://policy.example.org').pathname!==path||normalizePath(path)!==path)throw new Error('Use the canonical path without dot segments, duplicate or trailing slashes.');
  return mode==='exact'?literalExactPath(path):literalPathPrefix(path);
}
