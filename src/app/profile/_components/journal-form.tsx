"use client";

import { upload } from "@vercel/blob/client";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/components/locale-provider";
import {
  startTransition,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { JournalUploadContext } from "./journal-upload-context";
import { buildUploadPath, type UploadKind } from "@/lib/upload-file-type";

type JournalFormProps = {
  action: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  children: ReactNode;
  userId: string;
  draftKey: string;
  successHref: string;
};

type UploadedJournalMedia = {
  kind: UploadKind;
  pathname: string;
  fileName: string;
};

function getFile(formData: FormData, name: string) {
  return (
    formData
      .getAll(name)
      .find(
        (value): value is File => value instanceof File && value.size > 0,
      ) ?? null
  );
}

async function removeUpload(uploaded: UploadedJournalMedia) {
  await fetch("/api/journal/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: uploaded.kind, pathname: uploaded.pathname }),
  });
}

export function JournalForm({
  action,
  children,
  userId,
  draftKey,
  successHref,
}: JournalFormProps) {
  const router = useRouter();
  const t = useTranslations();
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const allowServerSubmitRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const uploadedMediaRef = useRef<UploadedJournalMedia[]>([]);

  async function save(formData: FormData) {
    setIsSaving(true);
    setError("");
    try {
      // Only upload references cross the server-action boundary. Keep the local
      // file inputs intact so a failed save can upload them again.
      formData.delete("image");
      formData.delete("audio");
      const result = await action(formData);
      if (result.error) {
        await Promise.allSettled(uploadedMediaRef.current.map(removeUpload));
        uploadedMediaRef.current = [];
        formRef.current
          ?.querySelectorAll(
            'input[name="imageUpload"], input[name="audioUpload"]',
          )
          .forEach((input) => input.remove());
        setError(result.error);
      } else if (result.success) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* Storage is optional. */
        }
        router.push(successHref);
      }
    } catch {
      setError(t("profileAction.journalSaveFailed"));
    } finally {
      allowServerSubmitRef.current = false;
      setIsSaving(false);
    }
  }

  async function uploadMedia(file: File, kind: "image" | "audio") {
    const target = buildUploadPath({
      fileId: crypto.randomUUID(),
      kind,
      mimeType: file.type,
      prefix: `journal/${userId}/`,
    });
    const blob = await upload(target.pathname, file, {
      access: "private",
      contentType: target.mimeType,
      handleUploadUrl: "/api/journal/upload",
      clientPayload: JSON.stringify({
        kind,
        pathname: target.pathname,
        fileName: file.name,
      }),
    });

    return {
      kind,
      pathname: blob.pathname,
      fileName: file.name,
    } satisfies UploadedJournalMedia;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (allowServerSubmitRef.current) {
      return;
    }
    if (isSaving || isUploading) {
      event.preventDefault();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const image = getFile(formData, "image");
    const audio = getFile(formData, "audio");
    if (!image && !audio) {
      return;
    }

    event.preventDefault();
    setError("");
    setIsUploading(true);
    const uploaded: UploadedJournalMedia[] = [];

    try {
      if (image) {
        uploaded.push(await uploadMedia(image, "image"));
      }
      if (audio) {
        uploaded.push(await uploadMedia(audio, "audio"));
      }

      for (const item of uploaded) {
        const fieldName = item.kind === "image" ? "imageUpload" : "audioUpload";
        let hiddenInput = form.querySelector<HTMLInputElement>(
          `input[name="${fieldName}"]`,
        );
        if (!hiddenInput) {
          hiddenInput = document.createElement("input");
          hiddenInput.name = fieldName;
          hiddenInput.type = "hidden";
          form.append(hiddenInput);
        }
        hiddenInput.value = JSON.stringify(item);
      }

      uploadedMediaRef.current = uploaded;
      allowServerSubmitRef.current = true;
      flushSync(() => setIsUploading(false));
      startTransition(() => form.requestSubmit());
    } catch (uploadError) {
      await Promise.allSettled(uploaded.map(removeUpload));
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload journal media. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <JournalUploadContext value={isUploading || isSaving}>
      <form
        action={save}
        className="grid gap-4"
        onReset={(event) => event.preventDefault()}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <fieldset
          className="grid min-w-0 gap-4"
          disabled={isUploading || isSaving}
        >
          {children}
        </fieldset>
        {error ? (
          <p className="text-sm font-semibold text-clay" role="status">
            {error}
          </p>
        ) : null}
      </form>
    </JournalUploadContext>
  );
}
