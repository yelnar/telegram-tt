import {
  insertLink,
  toggleBold,
  toggleMonospace,
  toggleSpoiler,
} from '../dom/dom';

describe('toggleBold', () => {
  let editor: HTMLElement;
  const containerId = 'editor';

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="${containerId}" contenteditable="true"></div>
    `;
    editor = document.getElementById('editor')!;
  });

  describe('when selection is single text', () => {
    const selectionText = 'test';

    describe('when selection is NOT bold', () => {
      test('applies bold', () => {
        editor.innerHTML = `This is a ${selectionText} content.`;
        const textNode = editor.firstChild as Text;

        const fullText = textNode.data;
        const startIndex = fullText.indexOf(selectionText);
        const endIndex = startIndex + selectionText.length;

        const range = document.createRange();
        range.setStart(textNode, startIndex);
        range.setEnd(textNode, endIndex);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is a <b>${selectionText}</b> content.`);
      });

      test('preserves other formats', () => {
        editor.innerHTML = `This is an <i>italic ${selectionText}</i> content.`;

        const italicElement = editor.querySelector('i') as HTMLElement;
        const textNode = italicElement.firstChild as Text;

        const fullText = textNode.data;
        const startIndex = fullText.indexOf(selectionText);
        const endIndex = startIndex + selectionText.length;

        const range = document.createRange();
        range.setStart(textNode, startIndex);
        range.setEnd(textNode, endIndex);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is an <i>italic <b>${selectionText}</b></i> content.`);
      });

      test('merges with adjacent bold text', () => {
        editor.innerHTML = `This is a <b>start</b>${selectionText}<b>end</b> content.`;
        const textNode = editor.childNodes[2] as Text;

        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, textNode.data.length);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is a <b>start${selectionText}end</b> content.`);
      });

      test('preserves line breaks outside of adjacent bold text', () => {
        editor.innerHTML = `This is a <b>start</b>\n${selectionText}\n<b>end</b> content.`;
        const textNode = editor.childNodes[2] as Text;

        const range = document.createRange();
        range.setStart(textNode, 1);
        range.setEnd(textNode, selectionText.length + 1);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is a <b>start\n${selectionText}\nend</b> content.`);
      });

      test('preserves line breaks inside of adjacent bold text', () => {
        editor.innerHTML = `This is a <b>start\n</b>${selectionText} content.`;
        const textNode = editor.childNodes[2] as Text;

        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, selectionText.length);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is a <b>start\n${selectionText}</b> content.`);
      });
    });

    describe('when selection IS bold', () => {
      test('removes bold', () => {
        editor.innerHTML = `This is a <b>${selectionText}</b> content.`;
        const boldElement = editor.querySelector('b');

        const range = document.createRange();
        range.selectNodeContents(boldElement!);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is a ${selectionText} content.`);
      });

      test('preserves other formats outside bold', () => {
        editor.innerHTML = `This is an <i>italic <b>${selectionText}</b></i> content.`;
        const boldElement = editor.querySelector('b');

        const range = document.createRange();
        range.selectNodeContents(boldElement!);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is an <i>italic ${selectionText}</i> content.`);
      });

      test('preserves other formats inside bold', () => {
        editor.innerHTML = `This is an <b><i>${selectionText}</i></b> content.`;
        const boldElement = editor.querySelector('i');

        const range = document.createRange();
        range.selectNodeContents(boldElement!);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is an <i>${selectionText}</i> content.`);
      });

      test('preserves bold text outside of selection', () => {
        editor.innerHTML = `This is a <b>bold ${selectionText}</b> content.`;
        const boldElement = editor.querySelector('b') as HTMLElement;

        const textNode = boldElement.firstChild as Text;

        const fullText = textNode.data;
        const startIndex = fullText.indexOf(selectionText);
        const endIndex = startIndex + selectionText.length;

        const range = document.createRange();
        range.setStart(textNode, startIndex);
        range.setEnd(textNode, endIndex);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is a <b>bold </b>${selectionText} content.`);
      });

      test('preserves line breaks inside bold text', () => {
        editor.innerHTML = `This is a <b>\nstart\n${selectionText}\nend</b> content.`;
        const boldElement = editor.querySelector('b') as HTMLElement;

        const textNode = boldElement.firstChild as Text;
        const fullText = textNode.data;

        const startIndex = fullText.indexOf(selectionText);
        const endIndex = startIndex + selectionText.length;

        const range = document.createRange();
        range.setStart(textNode, startIndex);
        range.setEnd(textNode, endIndex);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe(`This is a <b>\nstart\n</b>${selectionText}<b>\nend</b> content.`);
      });
    });
  });

  describe('when selection contains bold text', () => {
    describe('when selection contains smaller bold text', () => {
      test('applies bold and removes nested bold tag', () => {
        editor.innerHTML = 'This is a t<b>es</b>t content.';

        const textNode1 = editor.childNodes[0] as Text; // "This is a t"
        const textNode2 = editor.childNodes[2] as Text; // "t content."

        const range = document.createRange();
        range.setStart(textNode1, 10);
        range.setEnd(textNode2, 1);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe('This is a <b>test</b> content.');
      });
    });

    describe('when selection partially intersects with bold text', () => {
      test('applies bold for remaining part', () => {
        editor.innerHTML = 'This is a te<b>st co</b>ntent.';

        const textNode0 = editor.childNodes[0] as Text; // "This is a te"
        const textNode2 = editor.childNodes[2] as Text; // "ntent."

        const range = document.createRange();
        range.setStart(textNode0, 10);
        range.setEnd(textNode2, 5);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        toggleBold(containerId);

        expect(editor.innerHTML).toBe('This is a <b>test content</b>.');
      });
    });
  });
});

describe('toggleMonospace', () => {
  let editor: HTMLElement;
  const containerId = 'editor';

  beforeEach(() => {
    document.body.innerHTML = `<div id="${containerId}" contenteditable="true"></div>`;
    editor = document.getElementById(containerId)!;
  });

  test('applies monospace formatting to selection', () => {
    editor.innerHTML = 'This is a test content.';

    const textNode = editor.firstChild as Text;
    const fullText = textNode.data;
    const startIndex = fullText.indexOf('test');
    const endIndex = startIndex + 'test'.length;
    const range = document.createRange();
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, endIndex);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    toggleMonospace(containerId);

    expect(editor.innerHTML).toBe('This is a <code class="text-entity-code" dir="auto">test</code> content.');
  });

  test('removes monospace formatting from selection', () => {
    editor.innerHTML = 'This is a <code class="text-entity-code" dir="auto">test</code> content.';

    const codeEl = editor.querySelector('code');
    expect(codeEl).toBeTruthy();

    const range = document.createRange();
    range.selectNodeContents(codeEl!);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    toggleMonospace(containerId);

    expect(editor.innerHTML).toBe('This is a test content.');
  });
});

describe('toggleSpoiler', () => {
  let editor: HTMLElement;
  const containerId = 'editor';

  beforeEach(() => {
    document.body.innerHTML = `<div id="${containerId}" contenteditable="true"></div>`;
    editor = document.getElementById(containerId)!;
  });

  test('applies spoiler formatting to selection', () => {
    editor.innerHTML = 'This is a test content.';

    const textNode = editor.firstChild as Text;
    const fullText = textNode.data;
    const startIndex = fullText.indexOf('test');
    const endIndex = startIndex + 'test'.length;
    const range = document.createRange();
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, endIndex);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    toggleSpoiler(containerId, 'spoiler');

    expect(editor.innerHTML).toBe('This is a <span class="spoiler" data-entity-type="spoiler">test</span> content.');
  });

  test('removes spoiler formatting from selection', () => {
    editor.innerHTML = 'This is a <span class="spoiler" data-entity-type="spoiler">test</span> content.';

    const spoilerEl = editor.querySelector('span.spoiler');
    expect(spoilerEl).toBeTruthy();

    const range = document.createRange();
    range.selectNodeContents(spoilerEl!);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    toggleSpoiler(containerId, 'spoiler');

    expect(editor.innerHTML).toBe('This is a test content.');
  });
});

describe('updateLink', () => {
  let editor: HTMLElement;
  const containerId = 'editor';

  beforeEach(() => {
    document.body.innerHTML = `<div id="${containerId}" contenteditable="true"></div>`;
    editor = document.getElementById(containerId)!;
  });

  test('applies link formatting when selection is plain text', () => {
    editor.innerHTML = 'This is a test content.';
    const textNode = editor.firstChild as Text;
    const startIndex = textNode.data.indexOf('test');
    const endIndex = startIndex + 'test'.length;
    const range = document.createRange();
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, endIndex);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    insertLink(containerId, range, 'http://example.com');

    expect(editor.innerHTML).toBe(
      'This is a <a href="http://example.com" class="text-entity-link" dir="auto">test</a> content.',
    );
  });

  test('updates href when selection is already linked', () => {
    editor.innerHTML = 'This is a <a href="http://old.com" class="text-entity-link" dir="auto">test</a> content.';

    const anchorEl = editor.querySelector('a') as HTMLElement;
    expect(anchorEl).toBeTruthy();
    const range = document.createRange();
    range.selectNodeContents(anchorEl);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    insertLink(containerId, range, 'http://new.com');

    expect(editor.innerHTML).toBe(
      'This is a <a href="http://new.com" class="text-entity-link" dir="auto">test</a> content.',
    );
  });
});
