const { test, expect } = require('@playwright/test');

// A minimal stand-in for a DOM container: findInContent only needs
// querySelectorAll('[id]') and each element's id.
function container(...ids) {
  const elements = ids.map(id => ({ id }));
  return {
    elements,
    querySelectorAll(selector) {
      expect(selector).toBe('[id]');
      return elements;
    },
  };
}

// Heading and table lookups must search only the rendered document, so a
// heading whose slug equals an app element id (e.g. "sidebar") is still found.
test.describe('findInContent', () => {
  let findInContent;

  test.beforeAll(async () => {
    ({ findInContent } = await import('../modules/content-lookup.js'));
  });

  test.afterEach(() => {
    delete globalThis.document;
  });

  test('finds the document element, not an app element with the same id', () => {
    const appSidebar = { id: 'sidebar' };
    globalThis.document = { getElementById: () => appSidebar };
    const content = container('intro', 'sidebar');
    expect(findInContent(content, 'sidebar')).toBe(content.elements[1]);
  });

  test('matches ids with characters that are special in CSS selectors', () => {
    const content = container('a.b', '1-start', 'x"y');
    expect(findInContent(content, '1-start')).toBe(content.elements[1]);
    expect(findInContent(content, 'x"y')).toBe(content.elements[2]);
  });

  test('returns null for a missing or empty id', () => {
    const content = container('intro');
    expect(findInContent(content, 'missing')).toBeNull();
    expect(findInContent(content, '')).toBeNull();
  });
});
