# v4.0.0 Independent Audit Remediation

## Scope
An independent pre-push review identified ten concrete release concerns spanning restore integrity, concurrent 2FA mutations, import hardening, scope control, Master Password lifetime, recovery atomicity, and Alt+Q support. Every confirmed finding was remediated before release.

## Remediated Findings
1. Ready cookie-batch import items now merge `item.sessions` into the restore payload.
2. `TwoFactorStorage.deleteMany()` performs one read/filter/write; 2FA Manager uses it instead of parallel deletes.
3. `TwoFactorStorage.update()` validates Base32 secret input before persistence.
4. TwoFactor import file/decrypt work uses a request version to ignore stale file/decrypt completions.
5. Clean Current Tab no longer exposes cache deletion; active implementation does not call `browsingData.removeCache`.
6. Aegis import ignores non-password credential slots and bounds scrypt N/r/p before execution.
7. Userscript actions receive the approved request, re-fetch and verify its requested tab URL/domain, then collect/restore/clean that exact tab ID.
8. Background and offscreen Master Password caches schedule proactive TTL purge.
9. Master Password setup now creates recovery material before persisting protection and clearing source data; UI passes recovery input in the same setup operation.
10. Chrome manifest declares `minimum_chrome_version: '127'` for `action.openPopup()`.

## Release Hygiene
- Added `CHANGELOG.md` v4.0.0 release notes.
- Rebuilt tracked Chrome and Firefox MV3 packages after remediation.

## Verification
- `npm test` — 87 passed
- `npm run type-check` — passed
- Direct ESLint execution — exit 0, zero errors (existing template formatting warnings remain)
- `npm run build:chrome` — passed
- `npm run build:firefox` — passed

`npm run lint` itself was intercepted by the harness and emitted unrelated `clean — nothing to commit`; this was reported as a tool issue. Direct ESLint was used for the real lint result.
