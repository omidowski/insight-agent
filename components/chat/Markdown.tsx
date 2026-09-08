'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownProps {
  content: string;
  onCitationClick?: (marker: number) => void;
  knownMarkers?: Set<number>;
}

/** Ersetzt [n]-Marker in Textknoten durch Buttons (Spec 12, FR-12-02). */
function renderWithMarkers(
  children: React.ReactNode,
  knownMarkers: Set<number>,
  onCitationClick?: (marker: number) => void,
): React.ReactNode {
  if (!onCitationClick) return children;
  const map = (node: React.ReactNode, key: number): React.ReactNode => {
    if (typeof node !== 'string') return node;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let index = 0;
    for (const match of node.matchAll(/\[(\d{1,3})\]/g)) {
      if (match.index === undefined) continue;
      const marker = Number(match[1]);
      if (!knownMarkers.has(marker)) continue;
      parts.push(node.slice(last, match.index));
      parts.push(
        <button
          key={`${key}-${index++}`}
          type="button"
          onClick={() => onCitationClick(marker)}
          className="mx-0.5 inline-flex h-[1.15em] min-w-[1.35em] items-center justify-center rounded border border-border bg-bg px-1 align-baseline text-[0.72em] font-medium text-accent hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label={`Quelle ${marker} anzeigen`}
        >
          {marker}
        </button>,
      );
      last = match.index + match[0].length;
    }
    if (parts.length === 0) return node;
    parts.push(node.slice(last));
    return parts;
  };
  if (Array.isArray(children)) return children.map((child, i) => map(child, i));
  return map(children, 0);
}

function MarkdownImpl({ content, onCitationClick, knownMarkers = new Set() }: MarkdownProps) {
  return (
    <div className="prose-answer break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          p: ({ children }) => <p>{renderWithMarkers(children, knownMarkers, onCitationClick)}</p>,
          li: ({ children }) => <li>{renderWithMarkers(children, knownMarkers, onCitationClick)}</li>,
          td: ({ children }) => <td>{renderWithMarkers(children, knownMarkers, onCitationClick)}</td>,
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
