// Post-render setup for the document view: mermaid diagrams, table toggles, the
// outline panel, and link interception. These run after the active tab's HTML is
// inserted into #markdownContent.
import { markdownContent, outlineContainer, contentWrapper } from './dom.js';
import { state } from './state.js';
import { createTab } from './tabs.js';

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
    securityLevel: 'loose',
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
      const wrapper = document.getElementById(`table-wrapper-${tableId}`);

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

  let outlineHtml = '';

  outline.forEach(item => {
    outlineHtml += `
      <div class="outline-item level-${item.level}" data-id="${item.id}">
        ${item.text}
      </div>
    `;
  });

  outlineContainer.innerHTML = outlineHtml;

  // Add click handlers
  const outlineItems = outlineContainer.querySelectorAll('.outline-item');
  outlineItems.forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const targetElement = document.getElementById(id);
      if (targetElement) {
        // Scroll to the heading
        const offsetTop = targetElement.offsetTop - 80; // Offset for header
        contentWrapper.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });

        // Update active state
        outlineItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });
}

// Setup link interception on markdown content
export function setupLinkInterception() {
  const links = markdownContent.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', handleLinkClick);
  });
}

// Handle link clicks
async function handleLinkClick(e) {
  const href = e.currentTarget.getAttribute('href');
  if (!href) return;

  // Handle anchor links (scroll within document)
  if (href.startsWith('#')) {
    e.preventDefault();
    const targetId = href.slice(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      const offsetTop = targetElement.offsetTop - 80;
      contentWrapper.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
    return;
  }

  // Handle external URLs
  if (href.startsWith('http://') || href.startsWith('https://')) {
    e.preventDefault();
    window.electronAPI.openExternal(href);
    return;
  }

  // Handle relative links
  if (state.currentFile) {
    e.preventDefault();
    const result = await window.electronAPI.resolveLink(state.currentFile, href);

    if (result.success && result.exists && result.isMarkdown) {
      // Open markdown file in new tab
      await createTab(result.resolvedPath);
    } else if (result.success && result.exists) {
      // Open non-markdown file with system default
      window.electronAPI.openExternal(`file://${result.resolvedPath}`);
    }
  }
}
