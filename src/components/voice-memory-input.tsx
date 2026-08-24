"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  classifyRecordingStartFailure,
  getRecordingFileExtension,
  selectRecorderMimeType,
} from "@/lib/voice-recording";

const DEFAULT_MAX_RECORDING_SECONDS = 180;
const SILENT_INPUT_LEVEL = 3;
const SILENT_INPUT_FRAME_LIMIT = 120;

type WindowWithWebKitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function getRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return selectRecorderMimeType((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

export function VoiceMemoryInput({
  framed = true,
  maxRecordingSeconds = DEFAULT_MAX_RECORDING_SECONDS,
  showIntro = true,
}: {
  framed?: boolean;
  maxRecordingSeconds?: number;
  showIntro?: boolean;
}) {
  const t = useTranslations();
  const recordingLimitSeconds = Math.max(1, Math.floor(maxRecordingSeconds));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peakInputLevelRef = useRef(0);
  const silentFrameCountRef = useRef(0);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [inputWarning, setInputWarning] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [hasCheckedRecordingSupport, setHasCheckedRecordingSupport] =
    useState(false);
  const [supportsRecording, setSupportsRecording] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSupportsRecording(
        Boolean(navigator.mediaDevices?.getUserMedia) &&
          typeof MediaRecorder !== "undefined",
      );
      setHasCheckedRecordingSupport(true);
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
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      audioSourceRef.current?.disconnect();
      void audioContextRef.current?.close().catch(() => {});
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

  function stopMicMonitor() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    silentFrameCountRef.current = 0;
    setInputLevel(0);
  }

  function startMicMonitor(stream: MediaStream) {
    stopMicMonitor();

    const AudioContextConstructor =
      window.AudioContext ??
      (window as WindowWithWebKitAudioContext).webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      const samples = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      audioSourceRef.current = source;

      function readInputLevel() {
        analyser.getByteTimeDomainData(samples);

        let sum = 0;
        for (const sample of samples) {
          const centeredSample = (sample - 128) / 128;
          sum += centeredSample * centeredSample;
        }

        const level = Math.min(
          100,
          Math.round(Math.sqrt(sum / samples.length) * 220),
        );
        peakInputLevelRef.current = Math.max(peakInputLevelRef.current, level);

        if (level <= SILENT_INPUT_LEVEL) {
          silentFrameCountRef.current += 1;
        } else {
          silentFrameCountRef.current = 0;
          setInputWarning("");
        }

        if (silentFrameCountRef.current === SILENT_INPUT_FRAME_LIMIT) {
          setInputWarning(t("voiceMemory.noSignal"));
        }

        setInputLevel((currentLevel) =>
          Math.abs(currentLevel - level) >= 2 ? level : currentLevel,
        );
        animationFrameRef.current = window.requestAnimationFrame(readInputLevel);
      }

      animationFrameRef.current = window.requestAnimationFrame(readInputLevel);
    } catch {
      stopMicMonitor();
    }
  }

  function clearRecording() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setRecordedUrl("");
    setFileName("");
    setInputLevel(0);
    setInputWarning("");
    setSeconds(0);
    peakInputLevelRef.current = 0;
    silentFrameCountRef.current = 0;
    chunksRef.current = [];

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleAudioSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = URL.createObjectURL(selectedFile);
    setRecordedUrl(objectUrlRef.current);
    setFileName(selectedFile.name);
    setError("");
    setInputWarning("");
    setSeconds(0);
  }

  function getStartErrorMessage(error: unknown) {
    switch (classifyRecordingStartFailure(error)) {
      case "permission-denied":
        return t("voiceMemory.permissionDenied");
      case "microphone-unavailable":
        return t("voiceMemory.microphoneUnavailable");
      case "microphone-busy":
        return t("voiceMemory.microphoneBusy");
      case "secure-context-required":
        return t("voiceMemory.secureContextRequired");
      default:
        return t("voiceMemory.couldNotStart");
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
      peakInputLevelRef.current = 0;
      silentFrameCountRef.current = 0;
      setInputLevel(0);
      setInputWarning("");
      startMicMonitor(stream);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const recordingType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordingType });
        if (blob.size === 0) {
          setError(t("voiceMemory.emptyRecording"));
          stopMicMonitor();
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }

        const extension = getRecordingFileExtension(recordingType);
        const recording = new File(
          [blob],
          `voice-memory-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
          { type: recordingType },
        );
        try {
          const transfer = new DataTransfer();
          transfer.items.add(recording);
          if (fileInputRef.current) {
            fileInputRef.current.files = transfer.files;
          }
        } catch {
          setError(t("voiceMemory.couldNotAttachRecording"));
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = URL.createObjectURL(blob);
        setRecordedUrl(objectUrlRef.current);
        setFileName(recording.name);
        if (peakInputLevelRef.current <= SILENT_INPUT_LEVEL) {
          setError(t("voiceMemory.noSignal"));
        }
        stopMicMonitor();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      });

      recorder.start();
      setSeconds(0);
      setIsRecording(true);
    } catch (recordingError) {
      setError(getStartErrorMessage(recordingError));
      setIsRecording(false);
      stopMicMonitor();
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

  return (
    <div
      className={cn(
        "grid gap-4",
        framed && "rounded-card border border-edge bg-canvas/70 p-4",
      )}
      ref={rootRef}
    >
      <div
        className={cn(
          "grid gap-3",
          framed && "rounded-inner border border-edge bg-surface p-4",
        )}
      >
        {showIntro ? (
          <div>
            <p className="section-label !mb-1">{t("voiceMemory.label")}</p>
            <p className="text-pretty text-sm font-semibold text-ink">
              {t("voiceMemory.prompt")}
            </p>
          </div>
        ) : null}
        {isRecording ? (
          <Button
            className="w-full"
            type="button"
            variant="destructive"
            onClick={stopRecording}
          >
            {t("voiceMemory.stop")}
          </Button>
        ) : (
          <Button
            disabled={!supportsRecording}
            className="w-full"
            type="button"
            onClick={startRecording}
          >
            {t("voiceMemory.record")}
          </Button>
        )}
        {hasCheckedRecordingSupport && !supportsRecording ? (
          <p className="text-sm font-semibold leading-relaxed text-ink-soft" role="status">
            {t("voiceMemory.browserUnavailable")}
          </p>
        ) : null}
        <span className="text-sm font-semibold text-ink-soft" aria-live="polite">
          {isRecording
            ? `${t("voiceMemory.recording")} ${formatDuration(seconds)}`
            : fileName || t("voiceMemory.none")}
        </span>
        {isRecording ? (
          <div className="grid gap-2">
            <div className="grid gap-1 text-xs font-bold text-ink-soft sm:flex sm:items-center sm:justify-between sm:gap-3">
              <span>{t("voiceMemory.inputLevel")}</span>
              {inputWarning ? (
                <span className="break-words text-clay sm:text-right">
                  {inputWarning}
                </span>
              ) : null}
            </div>
            <div
              aria-label={t("voiceMemory.inputLevel")}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={inputLevel}
              className="h-2 overflow-hidden rounded-pill border border-edge bg-canvas"
              role="meter"
            >
              <div
                className="h-full rounded-pill bg-sage transition-[width] duration-100"
                style={{ width: `${Math.max(inputLevel, 2)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {recordedUrl ? (
        <audio
          aria-label={t("voiceMemory.playback")}
          className="w-full"
          controls
          preload="metadata"
          src={recordedUrl}
        />
      ) : null}

      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-pill border border-edge bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-btn-ghost transition-colors hover:bg-sand-soft focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-canvas">
        <Upload aria-hidden="true" className="h-4 w-4" />
        {t("voiceMemory.uploadInstead")}
        <input
          accept="audio/webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/ogg"
          aria-label={t("voiceMemory.audioFile")}
          className="sr-only"
          disabled={isRecording}
          name="audio"
          onChange={handleAudioSelection}
          ref={fileInputRef}
          type="file"
        />
      </label>

      {error ? (
        <p className="text-sm font-semibold text-clay" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
