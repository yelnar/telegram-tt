/**
 * Returns the associated HTMLElement for the given Node.
 *
 * @param node - The Node to normalize.
 * @returns The corresponding HTMLElement or undefined.
 */
function getElement(node: Node): HTMLElement | undefined {
  const element = node.nodeType === Node.TEXT_NODE
    ? node.parentElement
    : node instanceof HTMLElement
      ? node
      : undefined;
  return element ?? undefined;
}

/**
 * Traverses upward from the given node to find an element that matches the specified tag,
 * stopping if an element with the specified boundaryId is reached.
 *
 * @param node - The starting Node (can be a text node or an HTMLElement).
 * @param boundaryId - The id of the boundary element.
 * @param tagName - A tag name (in lowercase) to look for, e.g. ['b', 'i', 'u', 'del'].
 * @returns The closest formatting HTMLElement found before reaching the boundary, or undefined if none is found.
 */
function findAncestorTag(
  node: Node,
  tagName: string,
  boundaryId: string,
): HTMLElement | undefined {
  let element = getElement(node);

  while (element) {
    if (tagName === element.tagName.toLowerCase()) {
      return element;
    }
    if (element.id === boundaryId) {
      break;
    }
    element = element.parentElement ?? undefined;
  }

  return undefined;
}

/**
 * Determines if the selection represented by the range is fully contained within a single tag element.
 *
 * @param range - The Range object representing the current selection.
 * @param tagName - The formatting tag name to check for.
 * @param boundaryId - The id of the boundary element.
 * @returns True if both the start and end of the selection are inside the same formatting element of the given tag.
 */
function isRangeWithinSameAncestorTag(range: Range, tagName: string, boundaryId: string): boolean {
  const startTagContainer = findAncestorTag(range.startContainer, tagName, boundaryId);
  const endTagContainer = findAncestorTag(range.endContainer, tagName, boundaryId);
  return !!startTagContainer && !!endTagContainer && startTagContainer === endTagContainer;
}

/**
 * Removes an element but preserves its children.
 *
 * @param el - The HTMLElement to unwrap.
 */
function unwrap(el: HTMLElement): void {
  const parent = el.parentNode as HTMLElement;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

/**
 * Removes any nested elements with the specified tag from within the given DocumentFragment.
 *
 * @param fragment - The DocumentFragment to clean up.
 * @param tagName - The tag name to remove from nested positions.
 */
function removeNestedTags(fragment: DocumentFragment, tagName: string): void {
  const nestedElements = fragment.querySelectorAll(tagName);
  nestedElements.forEach((el) => {
    while (el.firstChild) {
      el.parentNode!.insertBefore(el.firstChild, el);
    }
    el.parentNode!.removeChild(el);
  });
}

/**
 * Applies tag formatting to the given range.
 *
 * @param range - The Range object representing the current selection.
 * @param tagName - The formatting tag to check for.
 */
function applyTag(range: Range, tagName: string, attributes: { [key: string]: string } = {}): void {
  const tagEl = document.createElement(tagName);
  Object.keys(attributes).forEach((key) => {
    tagEl.setAttribute(key, attributes[key]);
  });
  const contents = range.extractContents();
  removeNestedTags(contents, tagName);
  tagEl.appendChild(contents);
  range.insertNode(tagEl);
  mergeAdjacentTags(tagEl);
}

/**
 * Returns an array of ancestor elements for the given node,
 * up to (but not including) the stopElement.
 */
function getAncestorChain(node: Node, stopElement: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let current: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  while (current && current !== stopElement) {
    chain.unshift(current);
    current = current.parentElement;
  }
  return chain;
}

/**
 * Copies all attributes from source element to target element.
 *
 * @param source - The element to copy attributes from.
 * @param target - The element to copy attributes to.
 */
function copyAttributes(source: HTMLElement, target: HTMLElement): void {
  Array.from(source.attributes).forEach((attr) => {
    target.setAttribute(attr.name, attr.value);
  });
}

/**
 * Removes bold formatting only from the selected range.
 * If the selection covers only a part of a tag element, that element is split
 * into before, selected, and after fragments. The selected fragment is reinserted
 * unwrapped, while the before and after fragments are rewrapped in tag element.
 *
 * @param range - The Range object representing the current selection.
 * @param tagName - The formatting tag name to check for.
 * @param boundaryId - The id of the boundary element.
 */
function removeTag(range: Range, tagName: string, boundaryId: string): void {
  const tagEl = findAncestorTag(range.startContainer, tagName, boundaryId);
  if (!tagEl) return;

  const tagRange = document.createRange();
  tagRange.selectNodeContents(tagEl);

  const doesSelectionCoverEntireTagElement = range.compareBoundaryPoints(Range.START_TO_START, tagRange) <= 0
    && range.compareBoundaryPoints(Range.END_TO_END, tagRange) >= 0;

  if (doesSelectionCoverEntireTagElement) {
    unwrap(tagEl);
    return;
  }

  const beforeRange = document.createRange();
  beforeRange.setStart(tagEl, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEnd(tagEl, tagEl.childNodes.length);

  const beforeFragment = beforeRange.extractContents();

  const selectedFragment = range.extractContents();
  const afterFragment = afterRange.extractContents();

  const startChain = getAncestorChain(range.startContainer, tagEl);
  const endChain = getAncestorChain(range.endContainer, tagEl);
  const commonChain: HTMLElement[] = [];
  for (let i = 0; i < Math.min(startChain.length, endChain.length); i++) {
    if (startChain[i] === endChain[i]) {
      commonChain.push(startChain[i]);
    } else {
      break;
    }
  }
  let finalSelectedFragment: DocumentFragment | Node = selectedFragment;
  if (commonChain.length > 0) {
    for (let i = commonChain.length - 1; i >= 0; i--) {
      const wrapper = document.createElement(commonChain[i].tagName.toLowerCase());
      copyAttributes(commonChain[i], wrapper);
      wrapper.appendChild(finalSelectedFragment);
      finalSelectedFragment = wrapper;
    }
  }

  const parent = tagEl.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();

  if (beforeFragment.childNodes.length > 0) {
    const beforeTag = document.createElement(tagName);
    copyAttributes(tagEl, beforeTag);
    beforeTag.appendChild(beforeFragment);
    frag.appendChild(beforeTag);
  }

  frag.appendChild(finalSelectedFragment);

  if (afterFragment.childNodes.length > 0) {
    const afterTag = document.createElement(tagName);
    copyAttributes(tagEl, afterTag);
    afterTag.appendChild(afterFragment);
    frag.appendChild(afterTag);
  }

  parent.replaceChild(frag, tagEl);
}

/**
 * Removes empty tag elements from the specified container.
 *
 * @param container - The HTMLElement to clean up.
 */
function cleanupEmptyTags(container: HTMLElement): void {
  ['b', 'i', 'u', 'del', 'code', 'span', 'blockquote'].forEach((tag) => {
    const tagElements = container.querySelectorAll(tag);
    tagElements.forEach((el) => {
      if (!el.textContent || el.textContent.trim() === '') {
        el.remove();
      }
    });
  });
}

/**
 * Merges immediately adjacent elements with same tag around the given element.
 *
 * @param tagEl - The target element to merge neighbors into.
 */
function mergeAdjacentTags(tagEl: HTMLElement): void {
  const tagName = tagEl.tagName.toLowerCase();

  let lineBreaks: ChildNode[] = [];
  let prev = tagEl.previousSibling;
  while (prev) {
    if (prev.nodeType === Node.TEXT_NODE && prev.textContent === '') {
      const whitespaceNode = prev;
      prev = prev.previousSibling;
      whitespaceNode.remove();
      continue;
    }

    if (prev.nodeType === Node.TEXT_NODE && prev.textContent === '\n') {
      lineBreaks.push(prev);
      prev = prev.previousSibling;
      continue;
    }

    if (
      prev.nodeType === Node.ELEMENT_NODE
      && (prev as HTMLElement).tagName.toLowerCase() === tagName
    ) {
      if (lineBreaks.length > 0) {
        lineBreaks.forEach((br) => tagEl.insertBefore(br, tagEl.firstChild));
        lineBreaks = [];
      }
      const prevEl = prev as HTMLElement;
      while (prevEl.lastChild) {
        tagEl.insertBefore(prevEl.lastChild, tagEl.firstChild);
      }
      prevEl.remove();
    }

    break;
  }

  let next = tagEl.nextSibling;
  while (next) {
    if (next.nodeType === Node.TEXT_NODE && next.textContent === '') {
      const whitespaceNode = next;
      next = whitespaceNode.nextSibling;
      whitespaceNode.remove();
      continue;
    }

    if (next.nodeType === Node.TEXT_NODE && next.textContent === '\n') {
      lineBreaks.push(next);
      next = next.nextSibling;
      continue;
    }

    if (
      next.nodeType === Node.ELEMENT_NODE
      && (next as HTMLElement).tagName.toLowerCase() === tagName
    ) {
      if (lineBreaks) {
        lineBreaks.forEach((br) => tagEl.appendChild(br));
        lineBreaks = [];
      }
      const nextEl = next as HTMLElement;
      while (nextEl.firstChild) {
        tagEl.appendChild(nextEl.firstChild);
      }
      nextEl.remove();
    }

    break;
  }
}

/**
 * Toggles a given formatting tag on the current selection.
 *
 * @param boundaryId - The id of the boundary element.
 * @param tagName - The formatting tag name (e.g., 'b', 'i', 'u', 'del').
 */
function toggleTag(boundaryId: string, tagName: string, attributes?: { [key: string]: string }): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  if (isRangeWithinSameAncestorTag(range, tagName, boundaryId)) {
    removeTag(range, tagName, boundaryId);
  } else {
    applyTag(range, tagName, attributes);
  }

  const container = document.getElementById(boundaryId);
  if (container) {
    cleanupEmptyTags(container);
  }
}

/**
 * Toggles bold formatting on the current selection.
 *
 * @param boundaryId - The id of the boundary element.
 */
export function toggleBold(boundaryId: string): void {
  toggleTag(boundaryId, 'b');
}

/**
 * Toggles italic formatting on the current selection.
 *
 * @param boundaryId - The id of the boundary element.
 */
export function toggleItalic(boundaryId: string): void {
  toggleTag(boundaryId, 'i');
}

/**
 * Toggles underline formatting on the current selection.
 *
 * @param boundaryId - The id of the boundary element.
 */
export function toggleUnderline(boundaryId: string): void {
  toggleTag(boundaryId, 'u');
}

/**
 * Toggles strikethrough formatting on the current selection.
 *
 * @param boundaryId - The id of the boundary element.
 */
export function toggleStrikethrough(boundaryId: string): void {
  toggleTag(boundaryId, 'del');
}

/**
 * Toggles monospace formatting on the current selection by wrapping it in a
 * <code class="text-entity-code" dir="auto"></code> tag.
 *
 * @param boundaryId - The id of the boundary element.
 */
export function toggleMonospace(boundaryId: string): void {
  toggleTag(boundaryId, 'code', { class: 'text-entity-code', dir: 'auto' });
}

/**
 * Toggles spoiler formatting on the current selection.
 * This wraps the selection in a <span> element with class "spoiler" and a data attribute.
 *
 * @param boundaryId - The id of the boundary element.
 */
export function toggleSpoiler(boundaryId: string, entityType: string): void {
  toggleTag(boundaryId, 'span', { class: 'spoiler', 'data-entity-type': entityType });
}

/**
 * Toggles quote formatting on the current selection.
 *
 * @param boundaryId - The id of the contenteditable boundary element.
 */
export function toggleQuote(boundaryId: string): void {
  toggleTag(boundaryId, 'blockquote', { class: 'blockquote within-message' });
}
