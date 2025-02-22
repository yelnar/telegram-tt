import React, { useCallback, useMemo, useState } from '../../../../lib/teact/teact';

export type Style = 'BOLD' | 'ITALIC' | 'UNDERLINE' | 'STRIKETHROUGH';

export interface StyleRange {
  offset: number;
  length: number;
  style: Style;
}

export interface ContentState {
  text: string;
  styleRanges: StyleRange[];
}

function getSegments(content: ContentState): { text: string; styles: Style[] }[] {
  const { text, styleRanges } = content;
  const segments: { text: string; styles: Style[] }[] = [];
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

function renderContent(content: ContentState): JSX.Element {
  const segments = getSegments(content);
  return (
    <>
      {segments.map((seg, index) => {
        let inner: JSX.Element | string = seg.text;
        seg.styles.forEach((style) => {
          switch (style) {
            case 'BOLD':
              // eslint-disable-next-line react/no-array-index-key
              inner = <strong key={`${index}-bold`}>{inner}</strong>;
              break;
            case 'ITALIC':
              // eslint-disable-next-line react/no-array-index-key
              inner = <em key={`${index}-italic`}>{inner}</em>;
              break;
            case 'UNDERLINE':
              // eslint-disable-next-line react/no-array-index-key
              inner = <u key={`${index}-underline`}>{inner}</u>;
              break;
            case 'STRIKETHROUGH':
              // eslint-disable-next-line react/no-array-index-key
              inner = <s key={`${index}-strike`}>{inner}</s>;
              break;
          }
        });
        // eslint-disable-next-line react/no-array-index-key
        return inner;
      })}
    </>
  );
}

function getSelectionOffsets(editor: HTMLElement): { start: number; end: number } | undefined {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;
  const range = selection.getRangeAt(0);
  let currentOffset = 0;
  let start = -1;
  let end = -1;
  // eslint-disable-next-line no-null/no-null
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
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
}

function updateContentStyle(content: ContentState, style: Style, start: number, end: number): ContentState {
  const newRanges = [...content.styleRanges];
  let fullyStyled = true;
  for (let i = start; i < end; i++) {
    const covered = newRanges.some(
      (range) => range.style === style && i >= range.offset && i < range.offset + range.length,
    );
    if (!covered) {
      fullyStyled = false;
      break;
    }
  }
  if (fullyStyled) {
    // Remove the style from [start, end).
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
    return { ...content, styleRanges: updated };
  } else {
    newRanges.push({ offset: start, length: end - start, style });
    newRanges.sort((a, b) => a.offset - b.offset);
    return { ...content, styleRanges: newRanges };
  }
}

function toggleStyle(editor: HTMLElement, content: ContentState, style: Style): ContentState {
  const offsets = getSelectionOffsets(editor);
  if (!offsets) return content;
  return updateContentStyle(content, style, offsets.start, offsets.end);
}

/**
 * Updates inline style ranges after a change (insertion, deletion, or replacement).
 *
 * @param styleRanges - The current array of style ranges.
 * @param start - The start offset of the changed region (insertion point or deletion start).
 * @param end - The end offset of the changed region (deletion end; equals start for insertion).
 * @param insertedLength - The length of the inserted text.
 * @returns A new array of style ranges updated to reflect the change.
 */
function updateStyleRanges(
  styleRanges: StyleRange[],
  start: number,
  end: number,
  insertedLength: number,
): StyleRange[] {
  const deletionLength = end - start;
  const newRanges: StyleRange[] = [];

  if (deletionLength === 0) {
    for (const range of styleRanges) {
      if (start >= range.offset && start <= range.offset + range.length) {
        newRanges.push({
          offset: range.offset,
          length: range.length + insertedLength,
          style: range.style,
        });
      } else if (range.offset >= start) {
        newRanges.push({
          offset: range.offset + insertedLength,
          length: range.length,
          style: range.style,
        });
      } else {
        newRanges.push(range);
      }
    }
  } else {
    for (const range of styleRanges) {
      const rangeStart = range.offset;
      const rangeEnd = range.offset + range.length;
      if (rangeEnd <= start) {
        newRanges.push(range);
      } else if (rangeStart >= end) {
        newRanges.push({
          offset: rangeStart - deletionLength + insertedLength,
          length: range.length,
          style: range.style,
        });
      } else {
        if (rangeStart < start) {
          newRanges.push({
            offset: rangeStart,
            length: start - rangeStart,
            style: range.style,
          });
        }
        if (rangeEnd > end) {
          newRanges.push({
            offset: start + insertedLength,
            length: rangeEnd - end,
            style: range.style,
          });
        }
      }
    }
  }
  return newRanges;
}

/**
 * A minimal rich text editor hook for a single block.
 */
export function useRichTextEditor(editorRef: React.RefObject<HTMLDivElement>) {
  const [content, setContent] = useState<ContentState>({
    text: '',
    styleRanges: [],
  });

  const renderedContent = useMemo(() => renderContent(content), [content]);

  const toggleBold = useCallback(() => {
    const updated = toggleStyle(editorRef.current!, content, 'BOLD');
    setContent(updated);
  }, [content, editorRef]);

  const toggleItalic = useCallback(() => {
    const updated = toggleStyle(editorRef.current!, content, 'ITALIC');
    setContent(updated);
  }, [content, editorRef]);

  const toggleUnderline = useCallback(() => {
    const updated = toggleStyle(editorRef.current!, content, 'UNDERLINE');
    setContent(updated);
  }, [content, editorRef]);

  const toggleStrikethrough = useCallback(() => {
    const updated = toggleStyle(editorRef.current!, content, 'STRIKETHROUGH');
    setContent(updated);
  }, [content, editorRef]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { isComposing } = e;
    if (isComposing) return;

    const offsets = getSelectionOffsets(editorRef.current!);
    if (!offsets) return;

    const { start, end } = offsets;
    const deletionLength = end - start;

    const insertingNewLine = (e.key === 'Enter' && e.shiftKey)
    || (e.key === 'Enter' && !e.ctrlKey && !e.metaKey);

    if (insertingNewLine) {
      e.preventDefault();
      const insertedLength = 1; // "\n"
      setContent((prev) => {
        let newText = prev.text;
        if (deletionLength > 0) {
          newText = newText.slice(0, start) + newText.slice(end);
        }
        newText = `${newText.slice(0, start)}\n${newText.slice(start)}`;
        const newStyleRanges = updateStyleRanges(prev.styleRanges, start, end, insertedLength);
        return { ...prev, text: newText, styleRanges: newStyleRanges };
      });

      // requestAnimationFrame(() => {
      //   debugger;
      //   const sel = window.getSelection();
      //   if (!sel || !editorRef.current) return;
      //   const newRange = document.createRange();
      //   const firstNode = editorRef.current.firstChild;
      //   if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
      //     const caretOffset = Math.min(start + insertedLength, firstNode.textContent!.length);
      //     newRange.setStart(firstNode, caretOffset);
      //     newRange.collapse(true);
      //     sel.removeAllRanges();
      //     sel.addRange(newRange);
      //   }
      // });
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const insertedLength = e.key.length;

      setContent((prev) => {
        let newText = prev.text;
        if (deletionLength > 0) {
          newText = newText.slice(0, start) + newText.slice(end);
        }
        newText = newText.slice(0, start) + e.key + newText.slice(start);
        const newStyleRanges = updateStyleRanges(prev.styleRanges, start, end, insertedLength);
        return { ...prev, text: newText, styleRanges: newStyleRanges };
      });

      // requestAnimationFrame(() => {
      //   const sel = window.getSelection();
      //   if (!sel || !editorRef.current) return;
      //   const newRange = document.createRange();
      //   if (editorRef.current.firstChild && editorRef.current.firstChild.nodeType === Node.TEXT_NODE) {
      //     newRange.setStart(editorRef.current.firstChild, start + insertedLength);
      //     newRange.collapse(true);
      //     sel.removeAllRanges();
      //     sel.addRange(newRange);
      //   }
      // });
    }
  };

  const hasContent = content.text.length > 0;

  return {
    editorRef,
    content,
    renderedContent,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikethrough,
    onKeyDown,
    hasContent,
  };
}
