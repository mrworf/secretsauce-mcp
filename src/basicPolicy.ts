/** Translate a guided literal prefix into the existing regex policy contract. */
export function literalPathPrefix(prefix: string): string {
  return '^' + Array.from(prefix, character => '\\^$.*+?()[]{}|'.includes(character) ? '\\' + character : character).join('');
}
