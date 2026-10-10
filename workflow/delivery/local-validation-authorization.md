# Authorized local delivery validation

Product: secretsauce-mcp. Delivery goal: fixed milestones 10–17. Parent checkpoint: `148a2434d96cadde5caf1c8218b5531bb5f86ef8`.

The Product Owner instructed on 2026-10-10:

> you are permitted to run these tests using a headless browser, this system has docker, so outside of connecting this to a LLM system using MCP, all other test should be possible to do locally on this computer

Apply this instruction to this delivery goal: run all locally executable acceptance checks using the declared headless browser, synthetic OAuth/MCP clients and Docker on this computer. Actual connections to ChatGPT/Codex as LLM systems are deferred and do not block implementing and accepting local milestones 14–17. Record those real-client results as NOT RUN until actual execution; passing local protocol/browser tests establish only local behavior.

This is the explicit user-authorized exception to PRE-015's real-client acceptance gate at milestones 14 and 17. Preserve the original packet, product capabilities, security controls, real-client procedure and source revisions. Record the exception in delivery status and acceptance evidence. All other acceptance criteria, including current authorization, revocation, restart, Docker persistence, backup/restore and crash/failure checks, remain required. No product behavior or implementation capability is removed.

Local Docker validation may create isolated disposable containers, synthetic writable app/audit/backup/restore mounts and test images. Bind test endpoints to loopback, retain host-owned deployment state, and clean up only resources created by the test. Network/package/image retrieval and protected Docker/Git operations may require narrow sandbox escalation. Any actual deployment publication or external account login remains a separate action.

M14's committed local evidence (511 tests/53 files, build, actual HTTPS headless browser five groups/fourteen sanitized narrow-width captures) is current for implementation `1eb00d117664858d81252543b46c53cb8b46638d`. Accept its local delivery under this exception and continue milestone 15. At milestone 17 verify fresh OAuth/MCP reconnection locally after restore and keep actual LLM platform reconnect explicitly deferred.

Before a real-client interoperability or release claim, run the preserved procedure in `docs/m14-real-client-verification.md` for both actual clients, including post-restore fresh authorization/reconnect. Local-delivery completion does not provide that evidence.
