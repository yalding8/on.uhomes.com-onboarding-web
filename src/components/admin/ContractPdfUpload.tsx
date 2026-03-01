"use client";

/**
 * 非标准合同 PDF 上传 + LLM 字段提取组件
 *
 * 流程：选择 PDF → 上传到 Storage → 点击提取 → LLM 返回字段 → 回填表单
 */

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, Sparkles, Loader2, X } from "lucide-react";
import type { ContractFields } from "@/lib/contracts/types";

interface Props {
  contractId: string;
  uploadedUrl: string | null;
  onFieldsExtracted: (fields: Partial<ContractFields>) => void;
}

type Stage = "idle" | "uploading" | "uploaded" | "extracting" | "done";

export function ContractPdfUpload({
  contractId,
  uploadedUrl,
  onFieldsExtracted,
}: Props) {
  const [stage, setStage] = useState<Stage>(uploadedUrl ? "uploaded" : "idle");
  const [fileName, setFileName] = useState<string>(
    uploadedUrl ? "contract.pdf" : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [extractInfo, setExtractInfo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setError("Only PDF files are accepted");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10 MB limit");
        return;
      }

      setError(null);
      setFileName(file.name);
      setStage("uploading");

      const form = new FormData();
      form.append("file", file);

      try {
        const res = await fetch(`/api/admin/contracts/${contractId}/upload`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Upload failed");
          setStage("idle");
          return;
        }
        setStage("uploaded");
      } catch {
        setError("Network error during upload");
        setStage("idle");
      }
    },
    [contractId],
  );

  const handleExtract = useCallback(async () => {
    setError(null);
    setExtractInfo(null);
    setStage("extracting");

    try {
      const res = await fetch(`/api/admin/contracts/${contractId}/extract`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extraction failed");
        setStage("uploaded");
        return;
      }
      onFieldsExtracted(data.fields);
      setExtractInfo(`Extracted via ${data.provider}`);
      setStage("done");
    } catch {
      setError("Network error during extraction");
      setStage("uploaded");
    }
  }, [contractId, onFieldsExtracted]);

  const handleReset = useCallback(() => {
    setStage("idle");
    setFileName("");
    setError(null);
    setExtractInfo(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="mb-6 rounded-lg border border-dashed border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Upload Custom Contract PDF
        </h3>
        {stage !== "idle" && stage !== "uploading" && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
        Upload a non-standard contract PDF to auto-extract fields using AI.
      </p>

      {error && (
        <div className="mb-3 rounded-md bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning)]">
          {error}
        </div>
      )}

      {extractInfo && (
        <div className="mb-3 rounded-md bg-[var(--color-success-light)] px-3 py-2 text-xs text-[var(--color-success)]">
          {extractInfo} — review and edit fields below.
        </div>
      )}

      {stage === "idle" && (
        <label className="flex flex-col items-center justify-center gap-2 py-6 cursor-pointer rounded-md hover:bg-[var(--color-bg-secondary)] transition-colors">
          <Upload className="w-6 h-6 text-[var(--color-text-secondary)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            Click to select PDF (max 10 MB)
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </label>
      )}

      {stage === "uploading" && (
        <div className="flex items-center gap-2 py-4 justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading {fileName}...
        </div>
      )}

      {(stage === "uploaded" || stage === "done") && (
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[var(--color-text-secondary)]" />
          <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">
            {fileName}
          </span>
          {stage === "uploaded" && (
            <button
              type="button"
              onClick={handleExtract}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Extract Fields
            </button>
          )}
        </div>
      )}

      {stage === "extracting" && (
        <div className="flex items-center gap-2 py-4 justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          AI extracting fields from PDF...
        </div>
      )}
    </div>
  );
}
