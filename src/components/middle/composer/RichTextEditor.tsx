import React, { useCallback, useMemo, useState } from '../../../lib/teact/teact';

export type InlineStyle = 'BOLD' | 'ITALIC' | 'UNDERLINE' | 'STRIKETHROUGH';

export interface StyleRange {
  offset: number;
  length: number;
  style: InlineStyle;
}

export interface Block {
  key: string;
  text: string;
  styleRanges: StyleRange[];
}

export interface ContentState {
  blocks: Block[];
}

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Splits block text into segments based on inline style ranges.
 */
function getSegments(block: Block): { text: string; styles: InlineStyle[] }[] {
  const { text, styleRanges } = block;
  const segments: { text: string; styles: InlineStyle[] }[] = [];
  let i = 0;
  while (i < text.length) {
    const stylesAtI = styleRanges
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      .filter((range) => i >= range.offset && i < range.offset + range.length)
      .map((range) => range.style);
    let j = i + 1;
    while (j < text.length) {
      const stylesAtJ = styleRanges
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        .filter((range) => j >= range.offset && j < range.offset + range.length)
        .map((range) => range.style);
      if (JSON.stringify(stylesAtI) !== JSON.stringify(stylesAtJ)) break;
      j++;
    }
    segments.push({ text: text.slice(i, j), styles: stylesAtI });
    i = j;
  }
  return segments;
}

/**
 * Renders a block as JSX.
 */
function renderBlock(block: Block): JSX.Element {
  const segments = getSegments(block);
  return (
    <div key={block.key} data-block-key={block.key}>
      {segments.map((seg, index) => {
        let content: JSX.Element | string = seg.text;
        seg.styles.forEach((style) => {
          switch (style) {
            case 'BOLD':
              // eslint-disable-next-line react/no-array-index-key
              content = <strong key={`${block.key}-${index}-bold`}>{content}</strong>;
              break;
            case 'ITALIC':
              // eslint-disable-next-line react/no-array-index-key
              content = <em key={`${block.key}-${index}-italic`}>{content}</em>;
              break;
            case 'UNDERLINE':
              // eslint-disable-next-line react/no-array-index-key
              content = <u key={`${block.key}-${index}-underline`}>{content}</u>;
              break;
            case 'STRIKETHROUGH':
              // eslint-disable-next-line react/no-array-index-key
              content = <s key={`${block.key}-${index}-strike`}>{content}</s>;
              break;
          }
        });
        // eslint-disable-next-line react/no-array-index-key
        return <span key={`${block.key}-${index}`}>{content}</span>;
      })}
    </div>
  );
}

/**
 * Toggles an inline style for a given selection on a block.
 * For simplicity, this function assumes the selection is within one block.
 */
function toggleInlineStyle(block: Block, style: InlineStyle, start: number, end: number): Block {
  const newRanges = [...block.styleRanges];
  // Check if every character in [start, end) is styled.
  let fullyStyled = true;
  for (let i = start; i < end; i++) {
    // eslint-disable-next-line max-len
    const covered = newRanges.some((range) => range.style === style && i >= range.offset && i < range.offset + range.length);
    if (!covered) {
      fullyStyled = false;
      break;
    }
  }
  if (fullyStyled) {
    // Remove style from [start, end)
    const updated: StyleRange[] = [];
    for (const range of newRanges) {
      if (range.style !== style) {
        updated.push(range);
      } else {
        const rangeStart = range.offset;
        const rangeEnd = range.offset + range.length;
        if (rangeStart < start) {
          updated.push({ offset: rangeStart, length: start - rangeStart, style });
        }
        if (rangeEnd > end) {
          updated.push({ offset: end, length: rangeEnd - end, style });
        }
      }
    }
    newRanges.length = 0;
    newRanges.push(...updated);
  } else {
    // Add new range; for simplicity we do not merge overlapping ranges.
    newRanges.push({ offset: start, length: end - start, style });
    newRanges.sort((a, b) => a.offset - b.offset);
  }
  return { ...block, styleRanges: newRanges };
}

/**
 * A minimal rich text editor hook that manages an internal JSON model.
 */
export function useRichTextEditor(editorRef: React.RefObject<HTMLDivElement>) {
  const [content, setContent] = useState<ContentState>({
    blocks: [],
  });

  const renderedContent = useMemo(() => content.blocks.map(renderBlock), [content.blocks]);

  // Helper to compute selection offsets relative to a block element.
  const getSelectionOffsetsRelativeToBlock = useCallback(
    (block: HTMLElement): { start: number; end: number } | undefined => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return undefined;
      const range = selection.getRangeAt(0);
      let currentOffset = 0;
      let start = -1;
      let end = -1;
      // eslint-disable-next-line no-null/no-null
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
      let node: Node | null = walker.currentNode;
      if (!node || node.nodeType !== Node.TEXT_NODE) {
        node = walker.nextNode();
      }
      while (node) {
        if (node === range.startContainer) {
          start = currentOffset + range.startOffset;
        }
        if (node === range.endContainer) {
          end = currentOffset + range.endOffset;
          break;
        }
        currentOffset += (node.textContent || '').length;
        node = walker.nextNode();
      }
      return start >= 0 && end >= 0 ? { start, end } : undefined;
    },
    [],
  );

  // Given that blocks are rendered with data-block-key, we can determine which block the selection is in.
  const getSelectionBlockAndOffsets = useCallback(
    (): { block: Block | undefined; offsets: { start: number; end: number } | undefined } => {
      const blockElements = Array.from(document.querySelectorAll('[data-block-key]')) as HTMLElement[];
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return { block: undefined, offsets: undefined };
      const range = selection.getRangeAt(0);
      const blockEl = blockElements.find((el) => el.contains(range.startContainer));
      if (!blockEl) return { block: undefined, offsets: undefined };
      const blockKey = blockEl.getAttribute('data-block-key');
      const block = content.blocks.find((b) => b.key === blockKey);
      const offsets = getSelectionOffsetsRelativeToBlock(blockEl);
      return { block, offsets };
    },
    [content.blocks, getSelectionOffsetsRelativeToBlock],
  );

  const toggleBold = useCallback(() => {
    const { block, offsets } = getSelectionBlockAndOffsets();
    if (!block || !offsets) return;
    const updatedBlock = toggleInlineStyle(block, 'BOLD', offsets.start, offsets.end);
    setContent((prev) => ({ blocks: prev.blocks.map((b) => (b.key === block.key ? updatedBlock : b)) }));
    // window.getSelection()?.removeAllRanges();
  }, [getSelectionBlockAndOffsets]);

  const toggleItalic = useCallback(() => {
    const { block, offsets } = getSelectionBlockAndOffsets();
    if (!block || !offsets) return;
    const updatedBlock = toggleInlineStyle(block, 'ITALIC', offsets.start, offsets.end);
    setContent((prev) => ({ blocks: prev.blocks.map((b) => (b.key === block.key ? updatedBlock : b)) }));
    // window.getSelection()?.removeAllRanges();
  }, [getSelectionBlockAndOffsets]);

  const toggleUnderline = useCallback(() => {
    const { block, offsets } = getSelectionBlockAndOffsets();
    if (!block || !offsets) return;
    const updatedBlock = toggleInlineStyle(block, 'UNDERLINE', offsets.start, offsets.end);
    setContent((prev) => ({ blocks: prev.blocks.map((b) => (b.key === block.key ? updatedBlock : b)) }));
    // window.getSelection()?.removeAllRanges();
  }, [getSelectionBlockAndOffsets]);

  const toggleStrikethrough = useCallback(() => {
    const { block, offsets } = getSelectionBlockAndOffsets();
    if (!block || !offsets) return;
    const updatedBlock = toggleInlineStyle(block, 'STRIKETHROUGH', offsets.start, offsets.end);
    setContent((prev) => ({ blocks: prev.blocks.map((b) => (b.key === block.key ? updatedBlock : b)) }));
    // window.getSelection()?.removeAllRanges();
  }, [getSelectionBlockAndOffsets]);

  // On blur, update the block's text (for this minimal example, we reset inline styles).
  const onBlur = useCallback(() => {
    if (!editorRef.current) return;
    const newText = editorRef.current.innerText;
    setContent((prev) => ({
      blocks: prev.blocks.map((block) => ({ ...block, text: newText, styleRanges: [] })),
    }));
  }, [editorRef]);

  return {
    editorRef,
    renderedContent,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikethrough,
    onBlur,
    content, // Expose content state for further use if needed.
  };
}
