# Dependency security refresh

Baseline `e853367`, with unrelated untracked files outside this work. Scope covers the npm manifest and resolution tree, official runtime and browser test images, and CI action releases. Preserve the supported Node 22 runtime line and gateway behavior. The local instance and remote branch are outside this change.

Refresh direct npm releases and regenerate vulnerable transitive resolutions together. Check the production and full trees against live advisories and map open Dependabot alerts to the resulting lockfile. Use targeted compatibility changes only when dependency updates require them. Confirm supported Node 22 compilation, the complete regression suite and actual headless browser smoke, because the scanner, transport, parser and test runner all change.

Refresh container and CI dependencies from upstream release metadata. Use a multi-architecture base image digest and immutable action SHAs. Verify image contents and applicable OS advisories, and build a disposable candidate without mounting deployed state or sending untracked files to the Docker daemon.

Publish owned changes, exact test results and the dependency review as one coherent dependency refresh. Report any inaccessible source, residual advisory, deferred incompatible release, or unverified platform explicitly.

The follow-up prevention change adds an npm audit gate and weekly Dependabot updates. GitHub reporting showed no branch protection on main. Repository rules, pushes, and a local-instance upgrade remain outside this transaction.

The final image uses patched Alpine packages, the current npm CLI in build stages, and no package managers in the runtime. Native tests run the unchanged assertions after Alpine-only timing failures. Record the final results and upstream-only findings in the linked dependency security review.

Completed. Both npm audit scopes and the final production image scan returned zero findings. Native Node 22.23.5 passed 858 tests across 87 files. The production image built, and the two isolated Chromium scenarios passed. The dependency review records the remaining upstream build/browser findings and remote merge-gate status.
