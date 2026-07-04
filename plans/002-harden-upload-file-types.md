# Plan 002: Block stored XSS through journal and photo-import uploads (extension/MIME allowlist)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 36636b8..HEAD -- src/lib/journal.ts`
> If `src/lib/journal.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `36636b8`, 2026-07-01
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/90

## Why this matters

User uploads (journal screenshots, journal voice notes, photo-import images) are written to `public/uploads/...` and served same-origin by Next.js. The stored file's extension is taken from the **user-supplied filename**, and the only type check is `file.type.startsWith("image/")` — where `file.type` is also attacker-controlled (set by the client). So a logged-in user can upload a file named `x.svg` with type `image/svg+xml` (or `x.html` with a spoofed `image/png` type) and get it served inline from the app's origin: stored XSS. Same-origin script can act as the user against server actions. The fix is a strict server-side allowlist: derive the stored extension only from an allowlisted MIME type, never from the filename.

## Current state

All uploads funnel through one function in `src/lib/journal.ts`:

```ts
// src/lib/journal.ts:57-65
function getSafeFileName(file: File) {
  const fallback = `${randomUUID()}.bin`;
  const baseName = (file.name || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return baseName || fallback;
}
```

```ts
// src/lib/journal.ts:91-107
async function saveUpload(file: File, folder: "journal" | "imports") {
  const safeFileName = getSafeFileName(file);
  const extension = path.extname(safeFileName) || getExtensionForMime(file.type);
  const storageKey = `uploads/${folder}/${randomUUID()}${extension}`;
  const diskPath = path.join(process.cwd(), "public", ...storageKey.split("/"));

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));

  return {
    url: `/${storageKey}`,
    storageKey,
    mimeType: file.type || "application/octet-stream",
    fileName: safeFileName,
    sizeBytes: file.size,
  };
}
```

The problem line is `const extension = path.extname(safeFileName) || ...` — `getSafeFileName` preserves dots, so `evil.svg` / `evil.html` keep their extension, and static serving picks Content-Type from that extension.

`getExtensionForMime` (`src/lib/journal.ts:67-89`) maps a few exact MIME types (`image/png`, `image/webp`, `audio/webm`, `audio/mpeg`, `audio/wav`) and **falls through to `.jpg` for everything else** — that fallback is also wrong for audio but not dangerous.

Callers and their existing checks (client-controlled, keep them as UX but don't trust them):
- `src/lib/journal.ts:442-447` — journal screenshot: `imageFile.type.startsWith("image/")` then `saveUpload(imageFile, "journal")`.
- `src/lib/journal.ts:451-460` — journal voice note: `audioFile.type.startsWith("audio/")` + size cap, then `saveUpload(audioFile, "journal")`.
- `src/lib/journal.ts:834` — photo import: MIME check earlier in the loop (failure branch writes an `ImportRow` with `error: messages.onlyImages`), then `saveUpload(file, "imports")`.

There are currently **no tests** in the repo; `npm test` runs Node's built-in runner (`node --experimental-strip-types --test`). Node version in dev is v26.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Typecheck | `npx tsc --noEmit`  | exit 0, no output   |
| Lint      | `npm run lint`      | exit 0 (3 pre-existing `no-img-element` warnings are OK) |
| Tests     | `npm test`          | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/lib/journal.ts` (specifically `getSafeFileName` usage, `getExtensionForMime`, `saveUpload`; you may add a small exported helper)
- `src/lib/upload-file-type.ts` (create — pure helper, so it can be unit-tested)
- `src/lib/upload-file-type.test.ts` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `prisma/schema.prisma` — `JournalMedia.fileName`/`mimeType` columns stay as-is; `fileName` remains display-only metadata.
- The caller-side `startsWith("image/")` checks and their user-facing error messages — leave them; they give friendly errors. The allowlist is enforcement, they are UX.
- Serving/headers configuration (`next.config.ts`, middleware) — a Content-Disposition hardening layer is deliberately deferred (see Maintenance notes).
- Existing files already in `public/uploads/` — cleanup is an operator task, not code.
- AI settings size limits (`photoImportMaxFileBytes`, `voiceMaxFileBytes`) — already enforced.

## Git workflow

- Branch: `advisor/002-harden-upload-file-types`
- One commit; short imperative subject, e.g. "Restrict upload types to an image/audio allowlist"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the pure allowlist helper

Create `src/lib/upload-file-type.ts`:

```ts
export type UploadKind = "image" | "audio";

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
};

// Returns the storage extension for an allowlisted MIME type, or null when
// the type must be rejected. The user-supplied filename is never consulted.
export function getAllowedUploadExtension(
  mimeType: string,
  kind: UploadKind,
): string | null {
  const table = kind === "image" ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
  return table[mimeType.toLowerCase().split(";")[0].trim()] ?? null;
}
```

Deliberate exclusions: `image/svg+xml` (scriptable — the vulnerability this plan fixes), anything not in the tables.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Enforce it in saveUpload

In `src/lib/journal.ts`:

1. Change `saveUpload`'s signature to accept the expected kind: `saveUpload(file: File, folder: "journal" | "imports", kind: UploadKind)`.
2. Replace the extension line:

```ts
const extension = getAllowedUploadExtension(file.type, kind);
if (!extension) {
  throw new Error(
    kind === "image"
      ? "Screenshot uploads must be PNG, JPEG, WebP, or GIF files."
      : "Voice uploads must be WebM, MP3, M4A, WAV, or OGG files.",
  );
}
```

3. `getSafeFileName` is still used for the returned display `fileName` — unchanged.
4. Delete `getExtensionForMime` (now unused) — after confirming nothing else calls it: `grep -n "getExtensionForMime" src/lib/journal.ts` must show only its definition before you delete.
5. Update the three call sites to pass the kind: `saveUpload(imageFile, "journal", "image")` (line ~446), `saveUpload(audioFile, "journal", "audio")` (line ~460), `saveUpload(file, "imports", "image")` (line ~834).

Error-handling convention: thrown `Error` messages from these paths surface to the user (see the existing `throw new Error("Screenshot uploads must be image files.")` at `src/lib/journal.ts:444`) — match that tone. For the photo-import loop, the throw from `saveUpload` will be caught by the loop's existing per-file error handling if present; check how the loop around line 834 handles thrown errors and, if it doesn't catch, add the MIME check result to the pre-existing `onlyImages` failure branch instead of throwing (keep per-file failure recording behavior identical to the current `onlyImages` branch at ~line 790-812).

**Verify**: `npx tsc --noEmit` → exit 0

**Verify**: `grep -n "path.extname(safeFileName)" src/lib/journal.ts` → no matches

### Step 3: Unit tests

Create `src/lib/upload-file-type.test.ts` (Node built-in runner; import with relative path and `.ts` extension — the `@/*` alias does not resolve under `node --test`):

Cases:
1. `getAllowedUploadExtension("image/png", "image")` → `".png"`.
2. `image/svg+xml` as image → `null` (the regression this plan exists for).
3. `text/html` as image → `null`.
4. `image/png` as **audio** → `null` (kind mismatch).
5. `audio/mpeg` as audio → `".mp3"`.
6. Parameterized MIME `image/jpeg; charset=utf-8` → `".jpg"`; uppercase `IMAGE/PNG` → `".png"`.

**Verify**: `npm test` → exit 0, 6 new tests pass. If discovery fails, `node --experimental-strip-types --test src/lib/upload-file-type.test.ts` and note it.

## Test plan

Covered in Step 3. The dangerous path (`saveUpload` writing to disk) is exercised indirectly; its enforcement decision is the pure helper, which is fully tested. No filesystem tests needed.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0; the 6 allowlist tests pass
- [ ] `grep -n "path.extname" src/lib/journal.ts` → no matches
- [ ] `grep -rn "getAllowedUploadExtension" src/lib/journal.ts` → at least one match (enforcement wired in)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `saveUpload` excerpt doesn't match the live code (drift).
- You find additional `writeFile`/upload sinks outside `saveUpload` (`grep -rn "writeFile" src/` returning sites other than `src/lib/journal.ts:98`) — report them instead of expanding scope.
- The photo-import loop's error handling would turn a single rejected file into a whole-job failure and you cannot keep per-file failure semantics without touching out-of-scope files.
- Anything requires changing the `JournalMedia` schema.

## Maintenance notes

- Adding a new upload type later = adding one entry to the allowlist tables + a test. Reviewers should reject any future code path that derives a stored extension from a user filename.
- Deferred hardening (worth a follow-up finding, not this plan): serve `public/uploads/` with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` via headers config; magic-number sniffing of file contents; moving uploads out of `public/` behind an ownership-checked route (journal media is private-by-default but URLs are unauthenticated once known).
- Existing already-uploaded `.svg`/other files (if any) are not sanitized by this change — operator should audit `public/uploads/` once after deploy: `Get-ChildItem -Recurse public/uploads | Where-Object { $_.Extension -notin ".png",".jpg",".webp",".gif",".webm",".mp3",".m4a",".wav",".ogg" }`.
