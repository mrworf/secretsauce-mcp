# Dependency security review — 2026-11-21 UTC

The review compared baseline `e853367` with the updated npm lockfile, Node/Alpine image, browser test image, and GitHub Actions references. GitHub API data comes from the public repository’s Dependabot alerts. npm audit severities describe the affected dependency, and CVSS scores below are advisory-provided v3.1 figures when available. No application-level exploitability or new vulnerability was established.

## Results

- npm originally identified **17 affected package entries**, including **10 in the production tree**. The updated production and full lockfiles each returned **zero known vulnerabilities** under npm audit.
- GitHub returned **10 currently open alerts**, all development-scoped. The affected Vite, Vitest, and mocker ranges are absent from the refreshed lockfile. Vitest 5 also removes Tinypool from the dependency tree.
- npm registry metadata shows all direct dependencies current on their selected lines. `@types/node` intentionally stays on the current Node 22 types to match the supported runtime. The updated dev toolchain needs Node 22.12 or newer.
- Secretlint 14 provides the existing rules internally. The worker uses those rules under their existing IDs, and both deprecated standalone rule wrappers were removed.
- The Node base image pins the official multi-architecture digest for Node 22.23.5 and Alpine 3.24.4. The base scan reported six distinct OS CVEs across OpenSSL and zlib. Docker now applies Alpine updates before the shared stage is used.
- All six GitHub Actions now use immutable commits resolved from current upstream stable releases. The workflow audits the full npm lockfile and Dependabot checks npm, Docker and Actions weekly.

## npm advisories

| Package | Baseline | Updated | npm severity | Representative upstream advisory |
| --- | --- | --- | --- | --- |
| `@hono/node-server` | 1.19.14 | 2.1.11 | moderate | [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9) · 5.9 <br> `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N` |
| `@modelcontextprotocol/sdk` | 1.29.0 | 1.32.2 | high | [GHSA-22jm-h49p-29qw](https://github.com/advisories/GHSA-22jm-h49p-29qw) · 8.6 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:L` |
| `@vitest/mocker` | 3.2.6 | 5.1.1 | moderate | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) · 5.9 <br> `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N` |
| `body-parser` | 2.3.0 | 2.4.0 | high | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) · 7.5 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` |
| `fast-uri` | 3.1.3 | 3.1.9 | high | [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) · 7.5 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` |
| `hono` | 4.12.28 | 4.13.19 | moderate | [GHSA-gqvv-2mrq-wpjv](https://github.com/advisories/GHSA-gqvv-2mrq-wpjv) · 6.5 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N` |
| `ip-address` | 10.2.0 | 10.7.6 | high | [GHSA-mwp4-54f8-5fhr](https://github.com/advisories/GHSA-mwp4-54f8-5fhr) · unscored |
| `js-yaml` | 4.3.0 | Removed | high | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) · 7.5 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` |
| `nanoid` | 3.3.16 | 3.3.20 | high | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) · 5.9 <br> `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H` |
| `postcss` | 8.5.19 | 8.5.33 | moderate | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) · unscored |
| `proxy-addr` | 2.0.7 | 2.0.8 | critical | [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) · 9.1 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` |
| `qs` | 6.15.3 | 6.17.1 | moderate | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) · 5.3 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` |
| `source-map-js` | 1.2.1 | 1.2.4 | high | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) · 7.5 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` |
| `tinypool` | 1.1.1 | Removed | critical | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) · unscored |
| `vite` | 7.3.6 | 8.3.8 | high | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) · unscored |
| `vitest` | 3.2.6 | 5.1.1 | critical | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) · 5.9 <br> `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N` |
| `zod` | 4.4.3 | 4.6.7 | high | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) · 7.5 <br> `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` |

The MCP SDK is used by the HTTP-facing gateway, and Zod validates data. Other production-tree findings may affect optional framework paths or parsing helpers that the gateway does not call. Vitest, Vite and their worker and mocker packages run as development tooling and are excluded from the production image. The package upgrade covers the affected versions irrespective of any particular feature path.

## Open GitHub alerts checked

| Alert | Package | Vulnerable range | Updated lockfile | Advisory |
| --- | --- | --- | --- | --- |
| #96 | `vite` | `<= 6.4.3` | 8.3.8 | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) · low |
| #95 | `vite` | `<= 6.4.3` | 8.3.8 | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) · medium |
| #94 | `vite` | `<= 6.4.3` | 8.3.8 | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) · high |
| #93 | `tinypool` | `<= 2.1.0` | Removed | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) · critical |
| #92 | `tinypool` | `< 2.1.2` | Removed | [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) · critical |
| #91 | `vite` | `<= 6.4.3` | 8.3.8 | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) · medium |
| #85 | `vite` | `<= 6.4.3` | 8.3.8 | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) · medium |
| #73 | `@vitest/mocker` | `>= 2.1.0-beta.7, < 4.1.12` | 5.1.1 | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) · medium |
| #40 | `vitest` | `>= 2.1.0, < 4.1.11` | 5.1.1 | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) · medium |
| #38 | `@vitest/mocker` | `>= 2.1.0, < 4.1.11` | 5.1.1 | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) · medium |

The remote default branch is `main`. GitHub reported no branch protection and returned no rulesets during this review. A required `quality-gates` check and a pull-request requirement are the server-side merge control. A local audit is early feedback. Advisories can be published after merge, so continuing scans and Dependabot updates matter. [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

## Container and build-tool findings

- **Application image.** Trivy returned zero OS and Node package findings after the rebuild. Alpine upgrades replaced `libcrypto3` and `libssl3` with `3.5.9-r1` and `zlib` with `1.4-r0`, clearing the six distinct package advisories on the pinned base. The initial image scan also found 23 JavaScript package findings, all under the unused global npm installation. The final runtime removes the bundled package managers, keeps Node 22.23.5, and runs as the existing non-root user.
- **Docker build stages.** Build-only npm was upgraded to the latest stable release, `12.2.3`. Trivy still reports two medium findings in its bundled `glob@13.0.6` and `minimatch@10.2.5`. These are upstream npm CLI dependencies and are absent from the runtime. No newer stable CLI release containing their fixes was available at review time. [CVE-2026-118773](https://nvd.nist.gov/vuln/detail/CVE-2026-118773) · [CVE-2026-118764](https://nvd.nist.gov/vuln/detail/CVE-2026-118764)
- **Browser test image.** The latest matching official Playwright 1.65.1 Ubuntu 24.04 image had 761 OS package/advisory pairs (225 distinct advisory IDs). Ten pairs had fixes listed and the four affected GStreamer packages were upgraded in the disposable browser test image. The other 751 pairs had no fixed version listed in the scan, including two package entries for one high advisory. Tests ran on synthetic HTTPS with the container network disabled. The browser image is outside the production build. [CVE-2025-3887](https://nvd.nist.gov/vuln/detail/CVE-2025-3887)
- The pinned application manifest includes Linux amd64 and arm64. The application build and image scan were performed on amd64. The workflow updates were verified locally and have not executed on GitHub.

## Verification

`npm ci`, `npm outdated`, `npm audit --include=dev --audit-level=low` and `npm audit --omit=dev --audit-level=low` verified the lockfile and matching Node type line. The advisory scan verifies currently known registry findings. Transitives remain within upstream version requirements. The production image and build-tool scans used the same Trivy vulnerability database snapshot. The Playwright login/security smoke and reviewed service-reference scenario passed on the patched test image.

An earlier Alpine-container regression run had timing-sensitive failures in backup, configuration history, restore installation, and token tests. It used the original assertions and deadlines. The final suite uses a clean tracked export and the checksum-verified official Node 22.23.5 Linux distribution.

The final native Node 22 suite passed **858 tests across 87 files**, including the original prior-reader assertions. The CI-only package-layer cache setting was checked against the pinned Docker action's manifest, and the focused workflow test verified audit-before-install ordering. Full Buildx and GitHub execution remain remote checks.
