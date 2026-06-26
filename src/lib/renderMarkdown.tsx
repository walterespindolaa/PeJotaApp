import React from "react";

/**
 * Sanitize a string to prevent XSS when used with dangerouslySetInnerHTML.
 * Escapes all HTML entities FIRST, then re-applies safe formatting tags.
 */
const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatInline = (text: string) => {
  // First escape all HTML to prevent XSS, then apply safe formatting
  const safe = escapeHtml(text);
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
};

export function renderMarkdownSections(md: string): JSX.Element[] {
  const lines = md.split("\n");
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 text-sm text-foreground/90 mb-4 ml-2">
          {listItems.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(li) }} />)}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={i} className="text-lg font-heading font-bold text-foreground mt-8 mb-3 pb-2 border-b border-border/40">{trimmed.slice(3)}</h2>
      );
    } else if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(<h3 key={i} className="text-base font-heading font-semibold text-foreground mt-5 mb-2">{trimmed.slice(4)}</h3>);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className="text-sm text-foreground/85 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
      );
    }
  });
  flushList();
  return elements;
}