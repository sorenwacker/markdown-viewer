// Replace the browser's list markers with real text so that selecting a list
// highlights and copies its bullets and numbers. Chromium never includes
// ::marker content in a selection. See docs/index.md.

// Insert a leading <span class="list-marker"> into every list item under
// container: "•" for unordered lists, "N." for ordered lists (honouring the
// list's start value). Items that begin with a task-list checkbox are skipped.
export function addListMarkers(container) {
  container.querySelectorAll('ul, ol').forEach(list => {
    const ordered = list.tagName === 'OL';
    let number = ordered ? (parseInt(list.getAttribute('start'), 10) || 1) : 0;
    for (const item of list.children) {
      if (item.tagName !== 'LI') continue;
      const first = item.firstElementChild;
      const isTask = first && first.tagName === 'INPUT' && first.type === 'checkbox'
        && !item.firstChild.textContent?.trim();
      if (isTask || item.querySelector(':scope > .list-marker')) {
        if (ordered) number += 1;
        continue;
      }
      const marker = document.createElement('span');
      marker.className = 'list-marker';
      marker.textContent = ordered ? `${number}. ` : '• ';
      item.prepend(marker);
      if (ordered) number += 1;
    }
  });
}
