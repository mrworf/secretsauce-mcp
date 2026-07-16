import { createScanner, ScanError, SyntaxKind } from "jsonc-parser";
import type { SensitiveNameMatcher } from "./sensitiveNames.js";

export interface SensitiveSourceFinding {
  start: number;
  end: number;
  secretValue: string;
  ruleIds: string[];
}

interface ScannedToken {
  kind: SyntaxKind;
  offset: number;
  length: number;
  value: string;
  error: ScanError;
}

export function findSensitiveJsonProperties(text: string, matcher: SensitiveNameMatcher): SensitiveSourceFinding[] {
  const tokens = scanMeaningfulTokens(text);
  const findings: SensitiveSourceFinding[] = [];
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    const key = tokens[index];
    const colon = tokens[index + 1];
    const value = tokens[index + 2];
    if (!key || !colon || !value || key.kind !== SyntaxKind.StringLiteral || colon.kind !== SyntaxKind.ColonToken
      || value.kind !== SyntaxKind.StringLiteral || key.error !== ScanError.None || value.error !== ScanError.None
      || value.value.length === 0) continue;
    const ruleIds = matcher.match(key.value);
    if (ruleIds.length === 0) continue;
    findings.push({
      start: value.offset + 1,
      end: value.offset + value.length - 1,
      secretValue: value.value,
      ruleIds,
    });
  }
  return findings;
}

function scanMeaningfulTokens(text: string): ScannedToken[] {
  const scanner = createScanner(text, false);
  const tokens: ScannedToken[] = [];
  for (;;) {
    const kind = scanner.scan();
    if (kind === SyntaxKind.EOF) return tokens;
    if (kind === SyntaxKind.Trivia || kind === SyntaxKind.LineBreakTrivia
      || kind === SyntaxKind.LineCommentTrivia || kind === SyntaxKind.BlockCommentTrivia) continue;
    tokens.push({
      kind,
      offset: scanner.getTokenOffset(),
      length: scanner.getTokenLength(),
      value: scanner.getTokenValue(),
      error: scanner.getTokenError(),
    });
  }
}
