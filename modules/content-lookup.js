// Element lookups scoped to the rendered document. Document ids come from
// heading text and raw HTML, so a lookup on the whole page could match an app
// element with the same id (a "Sidebar" heading has id="sidebar", like the
// app's #sidebar) instead of the document's own element.
export function findInContent(container, id) {
  if (!id) return null;
  for (const element of container.querySelectorAll('[id]')) {
    if (element.id === id) return element;
  }
  return null;
}
