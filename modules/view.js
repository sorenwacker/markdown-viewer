// Post-render setup for the document view: mermaid diagrams, table toggles, the
// outline panel, and link interception. These run after the active tab's HTML is
// inserted into #markdownContent.
import { markdownContent, outlineContainer, contentWrapper } from './dom.js';
import { state } from './state.js';
import { createTab } from './tabs.js';
import { findInContent } from './content-lookup.js';

// Render mermaid diagrams
export async function renderMermaidDiagrams() {
  if (typeof mermaid === 'undefined') {
    console.warn('Mermaid not loaded');
    return;
  }

  const mermaidDivs = markdownContent.querySelectorAll('.mermaid');
  if (mermaidDivs.length === 0) return;

  // Update mermaid theme based on dark mode
  const isDarkMode = document.body.classList.contains('dark-mode');
  mermaid.initialize({
    startOnLoad: false,
    theme: isDarkMode ? 'dark' : 'default',
    // Documents are untrusted: 'strict' encodes HTML in labels and disables
    // click directives, which could otherwise navigate the app window.
    securityLevel: 'strict',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true
    },
    er: {
      useMaxWidth: true
    }
  });

  try {
    await mermaid.run({
      nodes: mermaidDivs
    });
  } catch (error) {
    console.error('Mermaid rendering error:', error);
  }
}

// Setup table toggle buttons
export function setupTableToggles() {
  const toggleButtons = markdownContent.querySelectorAll('.table-toggle');

  toggleButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const tableId = button.getAttribute('data-table-id');
      const wrapper = findInContent(markdownContent, `table-wrapper-${tableId}`);
      if (!wrapper) return;

      if (wrapper.classList.contains('full-width')) {
        wrapper.classList.remove('full-width');
        button.textContent = 'Fit Width';
      } else {
        wrapper.classList.add('full-width');
        button.textContent = 'Scroll';
      }
    });
  });
}

// Scroll the document so an element sits just below the top. In edit mode the
// preview scrolls inside its own pane instead of the content wrapper.
function scrollToElement(element) {
  const container = contentWrapper.classList.contains('editing') ? markdownContent : contentWrapper;
  const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTo({
    top: container.scrollTop + offset - 24,
    behavior: 'smooth'
  });
}

// Render outline
export function renderOutline(outline) {
  if (!outline || outline.length === 0) {
    outlineContainer.innerHTML = `
      <div class="tree-empty">
        <p>No headings found</p>
        <p class="hint">This file has no headings</p>
      </div>
    `;
    return;
  }

  // Built as nodes, not HTML: heading text comes from the document.
  outlineContainer.replaceChildren(...outline.map(item => {
    const div = document.createElement('div');
    div.className = `outline-item level-${Number(item.level) || 1}`;
    div.dataset.id = item.id;
    div.textContent = item.text;
    return div;
  }));

  // Add click handlers
  const outlineItems = outlineContainer.querySelectorAll('.outline-item');
  outlineItems.forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const targetElement = findHeading(id);
      if (targetElement) {
        scrollToElement(targetElement);

        // Update active state
        outlineItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });
}

// Find an element by id inside the document only, so a heading cannot be
// confused with an app element that has the same id.
function findHeading(id) {
  return findInContent(markdownContent, id);
}

// Links are handled by one delegated listener, so anchors added after render
// (for example inside mermaid SVGs) are covered too.
let linkInterceptionInstalled = false;

export function setupLinkInterception() {
  if (linkInterceptionInstalled) return;
  linkInterceptionInstalled = true;
  markdownContent.addEventListener('click', handleLinkClick);
}

// Split a relative link into a decoded path and a fragment.
function splitRelativeLink(href) {
  const hashIndex = href.indexOf('#');
  const rawPath = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : href.slice(hashIndex + 1);
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    // Keep the raw path when it is not valid percent-encoding.
  }
  return { path: decodedPath, fragment };
}

function scrollToFragment(fragment) {
  if (!fragment) return;
  let id = fragment;
  try {
    id = decodeURIComponent(fragment);
  } catch {
    // Use the fragment as written.
  }
  const target = findHeading(id);
  if (target) scrollToElement(target);
}

// Handle link clicks
async function handleLinkClick(e) {
  const link = e.target.closest('a');
  if (!link || !markdownContent.contains(link)) return;
  const href = link.getAttribute('href') ?? link.getAttribute('xlink:href');
  if (!href) return;
  e.preventDefault();

  // Anchor links scroll within the document
  if (href.startsWith('#')) {
    scrollToFragment(href.slice(1));
    return;
  }

  // Links with a scheme (http:, mailto:, ...) go to the main process, which
  // decides what may be opened.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) {
    window.electronAPI.openExternal(href);
    return;
  }

  if (!state.currentFile) return;
  const { path: linkPath, fragment } = splitRelativeLink(href);
  if (!linkPath) {
    scrollToFragment(fragment);
    return;
  }
  const result = await window.electronAPI.resolveLink(state.currentFile, linkPath);
  if (!result.success || !result.exists) return;

  if (result.isMarkdown) {
    await createTab(result.resolvedPath);
    scrollToFragment(fragment);
  } else {
    window.electronAPI.openPath(result.resolvedPath);
  }
}
