"use client";

/**
 * DocumentViewerPanel — Full document viewer with citation highlighting (Layer 3).
 *
 * Fetches the full parsed markdown from the knowledge API and renders it
 * with the cited section highlighted. Uses react-markdown for rendering.
 *
 * Provenance: Brief 079 (knowledge base), text-block.tsx (markdown rendering).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";

interface DocumentViewerPanelProps {
  documentHash: string;
  highlightChunkId?: string;
  page?: number;
}

interface DocumentData {
  markdown: string;
  fileName: string;
  format: string;
  pageCount: number;
}

interface ChunkData {
  text: string;
  page: number;
  section: string;
}

export function DocumentViewerPanel({
  documentHash,
  highlightChunkId,
  page,
}: DocumentViewerPanelProps) {
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [chunk, setChunk] = useState<ChunkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Fetch document and chunk data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Fetch document markdown
        const docRes = await fetch(
          `/api/knowledge/document?hash=${encodeURIComponent(documentHash)}`,
        );
        if (!docRes.ok) {
          const err = await docRes.json() as { error?: string };
          throw new Error(err.error ?? "Failed to load document");
        }
        const docData = (await docRes.json()) as DocumentData;
        if (!cancelled) setDoc(docData);

        // Fetch chunk text for highlighting
        if (highlightChunkId) {
          const ctxRes = await fetch(
            `/api/knowledge/context?chunkId=${encodeURIComponent(highlightChunkId)}&window=0`,
          );
          if (ctxRes.ok) {
            const ctxData = (await ctxRes.json()) as { chunks: ChunkData[]; targetIndex: number };
            if (!cancelled && ctxData.chunks.length > 0) {
              setChunk(ctxData.chunks[ctxData.targetIndex] ?? ctxData.chunks[0]);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [documentHash, highlightChunkId]);

  // Scroll to highlighted section after render
  useEffect(() => {
    if (highlightRef.current && !loading) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [loading, chunk]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-text-muted justify-center">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/40" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent/60" />
        </span>
        Loading document...
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        <p>{error ?? "Document not available."}</p>
        <p className="mt-1 text-xs">Try re-ingesting the document.</p>
      </div>
    );
  }

  // Split markdown on page boundaries for rendering with page markers
  const pages = splitOnPageBreaks(doc.markdown);

  return (
    <div className="space-y-4">
      {/* Document header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <FileText size={16} className="text-text-muted flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{doc.fileName}</p>
          <p className="text-xs text-text-muted">
            {doc.format.toUpperCase()} · {doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Document content */}
      <div className="prose-sm max-w-none">
        {pages.map((pageContent, pageIdx) => (
          <div key={pageIdx}>
            {/* Page marker */}
            {pages.length > 1 && (
              <div className="flex items-center gap-2 my-3 text-xs text-text-muted">
                <span className="flex-1 border-t border-border" />
                <span>Page {pageIdx + 1}</span>
                <span className="flex-1 border-t border-border" />
              </div>
            )}

            {/* Render markdown with chunk highlighting */}
            <HighlightedMarkdown
              content={pageContent}
              chunkText={chunk && (pageIdx + 1) === chunk.page ? chunk.text : undefined}
              highlightRef={chunk && (pageIdx + 1) === chunk.page ? highlightRef : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Split markdown on page break markers (--- or # Page N).
 */
function splitOnPageBreaks(markdown: string): string[] {
  const pages: string[] = [];
  let current: string[] = [];

  for (const line of markdown.split("\n")) {
    if (line.match(/^---+$/) || line.match(/^#+\s*Page\s+\d+/i)) {
      if (current.length > 0) {
        pages.push(current.join("\n"));
        current = [];
      }
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) {
    pages.push(current.join("\n"));
  }

  return pages.length > 0 ? pages : [markdown];
}

/**
 * Render markdown with optional chunk text highlighted.
 */
function HighlightedMarkdown({
  content,
  chunkText,
  highlightRef,
}: {
  content: string;
  chunkText?: string;
  highlightRef?: React.RefObject<HTMLDivElement | null>;
}) {
  if (!chunkText) {
    return (
      <Markdown remarkPlugins={[remarkGfm]} className="text-sm leading-relaxed text-text-secondary">
        {content}
      </Markdown>
    );
  }

  // Find the chunk text within the page content and split around it
  const lowerContent = content.toLowerCase();
  const lowerChunk = chunkText.toLowerCase().trim();
  const idx = lowerContent.indexOf(lowerChunk);

  if (idx === -1) {
    // Chunk not found on this page — render without highlight
    return (
      <Markdown remarkPlugins={[remarkGfm]} className="text-sm leading-relaxed text-text-secondary">
        {content}
      </Markdown>
    );
  }

  const before = content.slice(0, idx);
  const match = content.slice(idx, idx + chunkText.trim().length);
  const after = content.slice(idx + chunkText.trim().length);

  return (
    <div className="text-sm leading-relaxed text-text-secondary">
      {before && (
        <Markdown remarkPlugins={[remarkGfm]}>{before}</Markdown>
      )}
      <div
        ref={highlightRef}
        className="bg-vivid/10 border-l-2 border-vivid rounded-r px-3 py-2 my-2"
      >
        <Markdown remarkPlugins={[remarkGfm]}>{match}</Markdown>
      </div>
      {after && (
        <Markdown remarkPlugins={[remarkGfm]}>{after}</Markdown>
      )}
    </div>
  );
}
