"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

type ColumnMapping = {
  title: string;
  platform: string;
  status: string;
  playtimeHours: string;
  completionPercent: string;
  notes: string;
  externalId: string;
};

type ImportSource = "GENERIC" | "PLAYSTATION" | "XBOX";

const fieldOptions: Array<{
  key: keyof ColumnMapping;
  labelKey:
    | "csv.field.title"
    | "csv.field.platform"
    | "csv.field.status"
    | "csv.field.playtime"
    | "csv.field.completion"
    | "csv.field.notes"
    | "csv.field.externalId";
  required?: boolean;
}> = [
  { key: "title", labelKey: "csv.field.title", required: true },
  { key: "platform", labelKey: "csv.field.platform" },
  { key: "status", labelKey: "csv.field.status" },
  { key: "playtimeHours", labelKey: "csv.field.playtime" },
  { key: "completionPercent", labelKey: "csv.field.completion" },
  { key: "notes", labelKey: "csv.field.notes" },
  { key: "externalId", labelKey: "csv.field.externalId" },
];
const optionalFieldOptions = fieldOptions.filter((field) => !field.required);

function createInitialMapping(headers: string[]): ColumnMapping {
  const lowerHeaders = headers.map((header) => header.toLowerCase());
  const findHeader = (patterns: string[]) => {
    const index = lowerHeaders.findIndex((header) =>
      patterns.some((pattern) => header.includes(pattern)),
    );
    return index >= 0 ? headers[index] : "";
  };

  return {
    title: findHeader(["title", "name", "game"]),
    platform: findHeader(["platform", "store", "console"]),
    status: findHeader(["status", "state"]),
    playtimeHours: findHeader(["hours", "playtime"]),
    completionPercent: findHeader(["completion", "complete", "progress", "%"]),
    notes: findHeader(["note", "review", "comment"]),
    externalId: findHeader([
      "id",
      "appid",
      "np title",
      "nptitle",
      "concept",
      "product",
      "service",
      "psn",
      "xbox",
      "xuid",
      "titleid",
      "title id",
    ]),
  };
}

function getProviderForSource(source: ImportSource) {
  return source === "GENERIC" ? undefined : source;
}

export function CsvImportWidget({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const t = useTranslations();
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [source, setSource] = useState<ImportSource>("GENERIC");
  const [mapping, setMapping] = useState<ColumnMapping>({
    title: "",
    platform: "",
    status: "",
    playtimeHours: "",
    completionPercent: "",
    notes: "",
    externalId: "",
  });
  const [error, setError] = useState("");
  const serializedMapping = useMemo(
    () =>
      JSON.stringify({
        ...mapping,
        provider: getProviderForSource(source),
    }),
    [mapping, source],
  );
  const sourceLabel =
    source === "PLAYSTATION"
      ? t("csv.playstation")
      : source === "XBOX"
        ? t("csv.xbox")
        : t("csv.generic");

  const previewRows = useMemo(() => {
    if (!rows.length || !mapping.title) {
      return [];
    }

    return rows
      .slice(0, 5)
      .map((row) => ({
        title: row[mapping.title] ?? "",
        platform: mapping.platform ? row[mapping.platform] ?? "" : "",
        status: mapping.status ? row[mapping.status] ?? "" : "owned",
        playtimeHours: mapping.playtimeHours
          ? row[mapping.playtimeHours] ?? ""
          : "",
        completionPercent: mapping.completionPercent
          ? row[mapping.completionPercent] ?? ""
          : "",
      }))
      .filter((row) => row.title.trim().length > 0);
  }, [mapping, rows]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    const text = await selectedFile.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length) {
      setError(parsed.errors[0]?.message ?? t("csv.error"));
      setHeaders([]);
      setRows([]);
      setCsvText("");
      return;
    }

    const nextHeaders = parsed.meta.fields ?? [];
    setError("");
    setFileName(selectedFile.name);
    setCsvText(text);
    setHeaders(nextHeaders);
    setRows(parsed.data.slice(0, 25));
    setMapping(createInitialMapping(nextHeaders));
  }

  return (
    <div className="grid gap-[18px]">
      {/* File upload zone */}
      <div className="rounded-card border border-dashed border-edge bg-canvas/60 p-[18px]">
        <label className="mb-3 block font-semibold" htmlFor="csv-upload">
          {t("csv.chooseFile")}
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="w-full file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sage-soft file:px-4 file:py-2 file:font-semibold file:transition-colors hover:file:bg-sand-soft"
        />
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {t("csv.helper")}
        </p>
      </div>

      {/* Error display */}
      {error ? (
        <p className="font-semibold text-clay" aria-live="assertive">
          {error}
        </p>
      ) : null}

      {/* Column mapping + preview + submit */}
      {headers.length ? (
        <form action={action} className="grid gap-[18px]">
          <input type="hidden" name="fileName" value={fileName} />
          <input type="hidden" name="csvText" value={csvText} />
          <input type="hidden" name="mapping" value={serializedMapping} />

          <label className="grid gap-2">
            <span className="font-medium">{t("csv.origin")}</span>
            <select
              value={source}
              onChange={(event) =>
                setSource(event.target.value as ImportSource)
              }
              className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
            >
              <option value="GENERIC">{t("csv.generic")}</option>
              <option value="PLAYSTATION">{t("csv.playstation")}</option>
              <option value="XBOX">{t("csv.xbox")}</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="font-medium">{t("csv.titleColumn")}</span>
            <select
              value={mapping.title}
              aria-required="true"
              onChange={(event) =>
                setMapping((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
            >
              <option value="">{t("csv.titlePrompt")}</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>

          <details className="rounded-inner border border-edge bg-canvas/60 p-4">
            <summary className="cursor-pointer text-sm font-bold">
              {t("csv.adjustOptional")}
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-3.5 max-lg:grid-cols-1">
              {optionalFieldOptions.map((field) => (
                <label className="grid gap-2" key={field.key}>
                  <span className="font-medium">{t(field.labelKey)}</span>
                  <select
                    value={mapping[field.key]}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                  >
                    <option value="">{t("csv.skipField")}</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>

          <div className="grid gap-2.5" aria-live="polite">
            <div className="section-label">{t("csv.preview")}</div>
            {source !== "GENERIC" ? (
              <p className="text-sm font-semibold text-ink-soft">
                {t("csv.sourceRows", { source: sourceLabel })}
              </p>
            ) : null}
            {previewRows.length ? (
              previewRows.map((row, index) => (
                <div
                  className="grid grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] items-center gap-3.5 rounded-card border border-edge bg-surface p-4 shadow-rest max-md:grid-cols-2"
                  key={`${row.title}-${index}`}
                >
                  <strong>{row.title}</strong>
                  <span>{row.platform || t("csv.noPlatform")}</span>
                  <span>{row.status || t("status.OWNED")}</span>
                  <span>{row.playtimeHours || "0"}h</span>
                  <span>{row.completionPercent || t("csv.noProgress")}</span>
                </div>
              ))
            ) : (
              <p className="leading-relaxed text-ink-soft">
                {t("csv.choosePreview")}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!mapping.title || !csvText}
          >
            {t("csv.import")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
