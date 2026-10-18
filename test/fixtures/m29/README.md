# Prior state reader

`consoleStore-v4.ts.txt` is an immutable copy of `src/consoleStore.ts` at commit `95b1415` (M28 acceptance parent). SHA-256: `6242451630eac02488cdabddd2f95098817f8116593b3f01d44eed1b91a6a1d3`.

M29 transpiles this exact reader and calls its constructor against a synthetic format-5 encrypted state after a pre-replacement failure. The subprocess reports that it reached the reader before checking rejection. This fixture avoids Git history requirements in shallow CI checkouts and source archives.
