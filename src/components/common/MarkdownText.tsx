import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MarkdownTextProps = {
  value?: string | null;
  className?: string;
  size?: "sm" | "md";
  muted?: boolean;
};

type MarkdownBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "heading";
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      type: "unordered-list";
      items: string[];
    }
  | {
      type: "ordered-list";
      items: Array<{
        order: string;
        text: string;
      }>;
    };

const INLINE_MARKERS = ["**", "__", "`", "*", "_"] as const;

export function MarkdownText({
  value,
  className,
  size = "md",
  muted = false,
}: MarkdownTextProps) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }

  const textClassName = cn(
    size === "sm" ? "text-xs leading-5" : "text-sm leading-6",
    muted ? "text-muted-foreground" : "text-foreground",
  );

  return (
    <div className={cn("space-y-2", className)}>
      {parseMarkdownBlocks(normalizedValue).map((block, blockIndex) => {
        switch (block.type) {
          case "heading":
            return (
              <div
                key={`heading-${blockIndex}`}
                className={cn(
                  "font-semibold tracking-tight",
                  block.level === 1 && "text-base",
                  block.level === 2 && "text-sm",
                  block.level === 3 && "text-xs uppercase tracking-wide",
                  muted ? "text-foreground" : "text-foreground",
                )}
              >
                {renderInlineMarkdown(block.text, `heading-${blockIndex}`)}
              </div>
            );
          case "unordered-list":
            return (
              <ul
                key={`ul-${blockIndex}`}
                className={cn("list-disc space-y-1 pl-5", textClassName)}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`ul-item-${blockIndex}-${itemIndex}`}>
                    {renderInlineMarkdown(item, `ul-item-${blockIndex}-${itemIndex}`)}
                  </li>
                ))}
              </ul>
            );
          case "ordered-list":
            return (
              <ol
                key={`ol-${blockIndex}`}
                className={cn("list-decimal space-y-1 pl-5", textClassName)}
              >
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`ol-item-${blockIndex}-${itemIndex}`}
                    value={Number.parseInt(item.order, 10)}
                  >
                    {renderInlineMarkdown(item.text, `ol-item-${blockIndex}-${itemIndex}`)}
                  </li>
                ))}
              </ol>
            );
          case "paragraph":
          default:
            return (
              <p key={`paragraph-${blockIndex}`} className={textClassName}>
                {renderParagraphLines(block.text, `paragraph-${blockIndex}`)}
              </p>
            );
        }
      })}
    </div>
  );
}

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const normalizedValue = value.replace(/\r\n/g, "\n");
  const lines = normalizedValue.split("\n");
  let paragraphBuffer: string[] = [];
  let unorderedListBuffer: string[] = [];
  let orderedListBuffer: Array<{ order: string; text: string }> = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphBuffer.join("\n"),
    });
    paragraphBuffer = [];
  };

  const flushUnorderedList = () => {
    if (unorderedListBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "unordered-list",
      items: unorderedListBuffer,
    });
    unorderedListBuffer = [];
  };

  const flushOrderedList = () => {
    if (orderedListBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "ordered-list",
      items: orderedListBuffer,
    });
    orderedListBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    const unorderedListMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedListMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);

    if (!trimmed) {
      flushParagraph();
      flushUnorderedList();
      flushOrderedList();
      continue;
    }

    if (headingMatch) {
      flushParagraph();
      flushUnorderedList();
      flushOrderedList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2] ?? "",
      });
      continue;
    }

    if (unorderedListMatch) {
      flushParagraph();
      flushOrderedList();
      unorderedListBuffer.push(unorderedListMatch[1] ?? "");
      continue;
    }

    if (orderedListMatch) {
      flushParagraph();
      flushUnorderedList();
      orderedListBuffer.push({
        order: orderedListMatch[1] ?? "1",
        text: orderedListMatch[2] ?? "",
      });
      continue;
    }

    flushUnorderedList();
    flushOrderedList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushUnorderedList();
  flushOrderedList();

  return blocks;
}

function renderParagraphLines(text: string, keyPrefix: string) {
  return text.split("\n").flatMap((line, lineIndex, lines) => {
    const nodes: ReactNode[] = renderInlineMarkdown(
      line,
      `${keyPrefix}-line-${lineIndex}`,
    );
    if (lineIndex === lines.length - 1) {
      return nodes;
    }

    return [...nodes, <br key={`${keyPrefix}-br-${lineIndex}`} />];
  });
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  while (cursor < text.length) {
    const nextMarker = findNextInlineMarker(text, cursor);
    if (!nextMarker) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (nextMarker.index > cursor) {
      nodes.push(text.slice(cursor, nextMarker.index));
    }

    const contentStart = nextMarker.index + nextMarker.marker.length;
    const closingIndex = text.indexOf(nextMarker.marker, contentStart);

    if (closingIndex === -1) {
      nodes.push(nextMarker.marker);
      cursor = contentStart;
      continue;
    }

    const innerText = text.slice(contentStart, closingIndex);
    if (!innerText) {
      nodes.push(nextMarker.marker);
      cursor = contentStart;
      continue;
    }

    const nodeKey = `${keyPrefix}-token-${tokenIndex}`;
    if (nextMarker.marker === "`") {
      nodes.push(
        <code
          key={nodeKey}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.92em] text-foreground"
        >
          {innerText}
        </code>,
      );
    } else if (nextMarker.marker === "**" || nextMarker.marker === "__") {
      nodes.push(
        <strong key={nodeKey} className="font-semibold text-foreground">
          {renderInlineMarkdown(innerText, nodeKey)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={nodeKey} className="italic">
          {renderInlineMarkdown(innerText, nodeKey)}
        </em>,
      );
    }

    tokenIndex += 1;
    cursor = closingIndex + nextMarker.marker.length;
  }

  return nodes;
}

function findNextInlineMarker(text: string, startIndex: number) {
  let bestMatch:
    | {
        marker: (typeof INLINE_MARKERS)[number];
        index: number;
      }
    | undefined;

  for (const marker of INLINE_MARKERS) {
    const index = text.indexOf(marker, startIndex);
    if (index === -1) {
      continue;
    }

    if (!bestMatch || index < bestMatch.index) {
      bestMatch = { marker, index };
    }
  }

  return bestMatch;
}
