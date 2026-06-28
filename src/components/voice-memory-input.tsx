"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

const DEFAULT_MAX_RECORDING_SECONDS = 180;

function getRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return (
    [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

function getFileExtension(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

export function VoiceMemoryInput({
  maxRecordingSeconds = DEFAULT_MAX_RECORDING_SECONDS,
}: {
  maxRecordingSeconds?: number;
}) {
  const t = useTranslations();
  const recordingLimitSeconds = Math.max(1, Math.floor(maxRecordingSeconds));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [supportsRecording, setSupportsRecording] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSupportsRecording(
        Boolean(navigator.mediaDevices?.getUserMedia) &&
          typeof MediaRecorder !== "undefined",
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const interval = window.setInterval(() => {
      setSeconds((current) => {
        const next = current + 1;
        if (next >= recordingLimitSeconds) {
          window.setTimeout(() => {
            if (recorderRef.current?.state === "recording") {
              recorderRef.current.stop();
            }
            setIsRecording(false);
          }, 0);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRecording, recordingLimitSeconds]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) {
      return;
    }

    function handleSubmit(event: SubmitEvent) {
      if (!isRecording) {
        return;
      }

      event.preventDefault();
      setError(t("voiceMemory.stopBeforeSave"));
    }

    form.addEventListener("submit", handleSubmit);

    return () => form.removeEventListener("submit", handleSubmit);
  }, [isRecording, t]);

  function clearRecording() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setRecordedUrl("");
    setFileName("");
    setSeconds(0);
    chunksRef.current = [];

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function startRecording() {
    if (!supportsRecording) {
      setError(t("voiceMemory.browserUnavailable"));
      return;
    }

    try {
      clearRecording();
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const recordingType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordingType });
        const extension = getFileExtension(recordingType);
        const recording = new File(
          [blob],
          `voice-memory-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
          { type: recordingType },
        );
        const transfer = new DataTransfer();

        transfer.items.add(recording);
        if (fileInputRef.current) {
          fileInputRef.current.files = transfer.files;
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = URL.createObjectURL(blob);
        setRecordedUrl(objectUrlRef.current);
        setFileName(recording.name);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      });

      recorder.start();
      setSeconds(0);
      setIsRecording(true);
    } catch {
      setError(t("voiceMemory.couldNotStart"));
      setIsRecording(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setRecordedUrl("");
    setSeconds(0);
    setFileName(file?.name ?? "");
  }

  return (
    <div
      className="grid gap-4 rounded-card border border-edge bg-canvas/70 p-4"
      ref={rootRef}
    >
      <div className="grid gap-3 rounded-inner border border-edge bg-surface p-4">
        <div>
          <p className="section-label !mb-1">{t("voiceMemory.label")}</p>
          <p className="text-pretty text-sm font-semibold text-ink">
            {t("voiceMemory.prompt")}
          </p>
        </div>
        {isRecording ? (
          <Button type="button" variant="destructive" onClick={stopRecording}>
            {t("voiceMemory.stop")}
          </Button>
        ) : (
          <Button
            disabled={!supportsRecording}
            type="button"
            onClick={startRecording}
          >
            {t("voiceMemory.record")}
          </Button>
        )}
        <span className="text-sm font-semibold text-ink-soft" aria-live="polite">
          {isRecording
            ? `${t("voiceMemory.recording")} ${formatDuration(seconds)}`
            : fileName || t("voiceMemory.none")}
        </span>
      </div>

      {recordedUrl ? (
        <audio className="w-full" controls src={recordedUrl} />
      ) : null}

      <details className="rounded-inner border border-edge bg-surface p-3">
        <summary className="cursor-pointer text-sm font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          {t("voiceMemory.uploadInstead")}
        </summary>
        <label className="mt-3 grid gap-2">
          <span className="text-sm font-semibold">{t("voiceMemory.audioFile")}</span>
          <input
            accept="audio/*"
            className="w-full text-sm file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sand-soft file:px-4 file:py-2 file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            name="audio"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
        </label>
      </details>

      {error ? (
        <p className="text-sm font-semibold text-clay" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
