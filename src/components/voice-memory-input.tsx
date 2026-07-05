"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    } catch {
      setError(t("voiceMemory.couldNotStart"));
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
        <audio className="w-full" controls src={recordedUrl} />
      ) : null}

      <input
        accept="audio/*"
        aria-label={t("voiceMemory.recordedAudioInput")}
        className="hidden"
        name="audio"
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      {error ? (
        <p className="text-sm font-semibold text-clay" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
