"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  content: string;
  onChange: (value: string) => void;
  onClose: () => void;
  showDownloadPdf?: boolean;
  title?: string;
}

export default function AiGeneratedContent({
  content,
  onChange,
  onClose,
  showDownloadPdf = false,
  title,
}: Props) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 400)}px`;
    }
  }, [content]);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadPdf() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || "Investor Update"}</title>
          <style>
            body {
              font-family: Georgia, 'Times New Roman', serif;
              max-width: 700px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.7;
              color: #1a1a1a;
              font-size: 14px;
            }
            h1 { font-size: 20px; margin-bottom: 24px; }
            p { margin-bottom: 12px; }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          ${title ? `<h1>${title}</h1>` : ""}
          ${content.split("\n").map((line) => (line.trim() ? `<p>${line}</p>` : "")).join("")}
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  return (
    <div className="rounded-xl p-4 mt-4 animate-fade-in" style={{
      background: "var(--ds-bg)",
      border: "1px solid var(--ds-border)",
    }}>
      <div className="flex items-center justify-between mb-3">
        {title && (
          <span className="text-xs font-medium" style={{ color: "var(--ds-muted)" }}>
            {title}
          </span>
        )}
        <button
          onClick={onClose}
          className="text-xs hover:underline ml-auto"
          style={{ color: "var(--ds-muted)" }}
        >
          Dismiss
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm resize-none focus:outline-none"
        style={{
          color: "var(--ds-text)",
          whiteSpace: "pre-wrap",
          minHeight: "120px",
        }}
      />
      <div className="flex items-center justify-end gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--ds-border)" }}>
        {showDownloadPdf && (
          <button
            onClick={handleDownloadPdf}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-80"
            style={{
              border: "1px solid var(--ds-border)",
              color: "var(--ds-text)",
            }}
          >
            Download as PDF
          </button>
        )}
        <button
          onClick={handleCopy}
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition hover:opacity-90"
          style={{
            background: "#0D9488",
          }}
        >
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
      </div>
    </div>
  );
}
