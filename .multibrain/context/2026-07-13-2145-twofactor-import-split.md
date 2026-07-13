# Two-Factor Entry and Import Split

## User Flow
The former Add 2FA action is now explicitly **Manual**. It retains Base32 secret and single OTPAuth URI entry. Scan remains a separate QR action. A new **Import** action opens `TwoFactorImportModal` with source guidance and validation-first intake.

## Supported Sources
- **Aegis Authenticator JSON**: plaintext vaults import after schema validation. Encrypted vaults (including `aegis-export-20260306-034436.json`) are detected before data is read, require the Aegis export password, decrypt in extension memory only, then preview validated TOTP entries before `importMany()` commits.
- **Google Authenticator**: pasted `otpauth-migration://offline?data=...` account-transfer migration URI. The extension contains a small protobuf decoder for TOTP records and converts raw secret bytes to Base32.
- **Standard OTPAuth URI lists**: one `otpauth://totp/...` URI per line; this covers plaintext interoperability exports from Bitwarden and Ente.

## Intentionally Unsupported
Authy and Microsoft Authenticator do not offer an appropriate official file export for safe browser-extension import. They are not shown as supported sources.

## Aegis Cryptography
Aegis's official vault contract is implemented directly: each password slot derives a wrapping key with scrypt using `n`, `r`, `p`, and `salt` from the export; AES-256-GCM unwraps the master key; AES-256-GCM decrypts and integrity-validates the database. `@noble/hashes` supplies browser-compatible async scrypt. Incorrect passwords never yield entries or permit import.

## Files
- `app/features/two-factor/importFormats.ts` — validated Aegis + Google migration + OTPAuth parsers.
- `app/popup/modals/TwoFactorImportModal.vue` — file/paste intake, password validation, preview, and batch commit.
- `app/popup/tabs/TwoFATab.vue` — Manual, Scan, and Import controls.
- `app/popup/App.vue`, `app/popup/composables/useModalStack.ts` — import modal registration.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 74 passed, including encrypted Aegis detection and plaintext Aegis preview.
- `npm run lint` — passed.
- `npm run type-check` — passed.
- `npm run build:chrome` — passed.
- `npm run build:firefox` — passed.
