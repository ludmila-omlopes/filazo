"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { buildUploadPath, getAllowedUploadMimeTypes } from "@/lib/upload-file-type";
import { validCatalogImage, type CatalogUpload } from "@/lib/catalog-upload-policy";

export function CatalogPhotoImportForm({ action, userId, maxFiles, maxBytes, disabled, unavailableBody }: {
  action: (data: FormData) => Promise<{ error?: string; success?: boolean; importedCount?: number }>;
  userId: string; maxFiles: number; maxBytes: number; disabled: boolean; unavailableBody: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "upload" | "import">("idle");
  const uploaded = useRef<CatalogUpload[]>([]);
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const size = Math.round(maxBytes / 1024 / 1024 * 10) / 10;

  function validate(selected: File[]) {
    if (!selected.length) return t("profileAction.photoUploadAtLeastOne");
    if (selected.length > maxFiles) return t("profile.photoImport.fileLimit", { count: maxFiles });
    if (selected.some(file => !getAllowedUploadMimeTypes("image").includes(file.type))) return t("profile.photoImport.invalidFormat");
    if (selected.some(file => !validCatalogImage(file, maxBytes))) return t("profile.photoImport.sizeLimit", { size });
    return "";
  }

  async function submit() {
    if (submitting.current || disabled) return;
    const invalid = validate(files);
    if (invalid) { setError(invalid); return; }
    submitting.current = true;
    setError("");
    setPhase("upload");
    try {
      for (let i = uploaded.current.length; i < files.length; i++) {
        const file = files[i];
        const target = buildUploadPath({ fileId: crypto.randomUUID(), kind: "image", mimeType: file.type, prefix: `imports/${userId}/` });
        const reference = { pathname: target.pathname, fileName: file.name.slice(0, 255) || "catalog-photo" };
        const blob = await upload(target.pathname, file, {
          access: "private", contentType: target.mimeType, handleUploadUrl: "/api/catalog/upload",
          clientPayload: JSON.stringify(reference),
        });
        uploaded.current.push({ ...reference, pathname: blob.pathname });
      }
      setPhase("import");
      const data = new FormData();
      data.set("uploads", JSON.stringify(uploaded.current));
      const result = await action(data);
      if (result.error) { setError(result.error); return; }
      if (!result.success) throw new Error("Import unavailable");
      router.push(`/profile?tab=integrations&photoImported=${result.importedCount ?? 0}`);
      router.refresh();
      uploaded.current = [];
      setFiles([]);
      if (input.current) input.current.value = "";
    } catch {
      setError(t("profile.photoImport.uploadFailed"));
    } finally { submitting.current = false; setPhase("idle"); }
  }

  return <form action={submit} className="grid gap-4">
    <label className="grid gap-2">
      <span className="text-sm font-semibold">{t("profile.photoImport.images")}</span>
      <input ref={input} type="file" accept={getAllowedUploadMimeTypes("image").join(",")} multiple disabled={disabled || phase !== "idle"}
        className="w-full file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sage-soft file:px-4 file:py-2 file:font-semibold"
        onChange={event => {
          const selected = Array.from(event.target.files ?? []);
          uploaded.current = [];
          setFiles(selected);
          setError(validate(selected));
        }} />
    </label>
    <p className="text-sm text-ink-soft">{t("profile.photoImport.limits", { count: maxFiles, size })}</p>
    {disabled ? <p className="text-sm font-semibold text-clay">{unavailableBody}</p> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-clay">{error}</p> : null}
    {phase !== "idle" ? <p role="status" className="text-sm text-ink-soft">{t(phase === "upload" ? "profile.photoImport.uploading" : "profile.photoImport.processing")}</p> : null}
    <Button disabled={disabled || phase !== "idle" || !files.length || Boolean(validate(files))} type="submit">
      {t("profile.photoImport.submit")}
    </Button>
  </form>;
}
