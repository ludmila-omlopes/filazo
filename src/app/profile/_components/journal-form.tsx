"use client";

import { upload } from "@vercel/blob/client";
import { startTransition, useRef, useState, type FormEvent, type ReactNode } from "react";
import { JournalUploadContext } from "./journal-upload-context";
import {
  buildUploadPath,
  type UploadKind,
} from "@/lib/upload-file-type";

type JournalFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  userId: string;
};

type UploadedJournalMedia = {
  kind: UploadKind;
  pathname: string;
  fileName: string;
};

function getFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function removeUpload(uploaded: UploadedJournalMedia) {
  await fetch("/api/journal/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: uploaded.kind, pathname: uploaded.pathname }),
  });
}

export function JournalForm({ action, children, userId }: JournalFormProps) {
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const allowServerSubmitRef = useRef(false);

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
      clientPayload: JSON.stringify({ kind, pathname: target.pathname, fileName: file.name }),
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

      for (const input of form.querySelectorAll<HTMLInputElement>(
        'input[type="file"]',
      )) {
        input.value = "";
      }

      allowServerSubmitRef.current = true;
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
    <JournalUploadContext value={isUploading}>
      <form action={action} className="grid gap-4" onSubmit={handleSubmit}>
        {children}
        {error ? (
          <p className="text-sm font-semibold text-clay" role="status">
            {error}
          </p>
        ) : null}
      </form>
    </JournalUploadContext>
  );
}
