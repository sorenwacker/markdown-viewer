// In-document search: highlight matches in the rendered content and navigate
// between them. The search controls wire their own listeners; renderer.js only
// needs openSearch for the Cmd/Ctrl+F shortcut.
import {
  searchBar, searchInput, searchCount, searchPrev, searchNext, searchClose,
  markdownContent,
} from './dom.js';

let searchMatches = [];
let currentMatchIndex = -1;
let searchTimeout;

export function openSearch() {
  searchBar.style.display = 'flex';
  searchInput.focus();
  searchInput.select();
}

function closeSearch() {
  searchBar.style.display = 'none';
  searchInput.value = '';
  clearHighlights();
  searchCount.textContent = '';
  searchMatches = [];
  currentMatchIndex = -1;
}

function clearHighlights() {
  const highlights = markdownContent.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
}

function performSearch(query) {
  clearHighlights();
  searchMatches = [];
  currentMatchIndex = -1;

  if (!query || query.length === 0) {
    searchCount.textContent = '';
    return;
  }

  const searchText = query.toLowerCase();
  const treeWalker = document.createTreeWalker(
    markdownContent,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    // Skip nodes inside mermaid diagrams and code blocks
    if (!node.parentElement.closest('.mermaid') &&
        !node.parentElement.closest('pre') &&
        !node.parentElement.closest('code')) {
      textNodes.push(node);
    }
  }

  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const lowerText = text.toLowerCase();
    let startIndex = 0;
    let index;

    while ((index = lowerText.indexOf(searchText, startIndex)) !== -1) {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + query.length);
      searchMatches.push(range.cloneRange());
      startIndex = index + 1;
    }
  });

  // Highlight all matches
  searchMatches.forEach((range, idx) => {
    try {
      const highlight = document.createElement('span');
      highlight.className = 'search-highlight';
      highlight.dataset.matchIndex = idx;
      range.surroundContents(highlight);
    } catch (_e) {
      // Range may cross element boundaries, skip this match
    }
  });

  // Re-collect highlighted elements as matches
  const highlightedElements = markdownContent.querySelectorAll('.search-highlight');
  searchMatches = Array.from(highlightedElements);

  if (searchMatches.length > 0) {
    currentMatchIndex = 0;
    highlightCurrentMatch();
    searchCount.textContent = `1 of ${searchMatches.length}`;
  } else {
    searchCount.textContent = 'No results';
  }
}

function highlightCurrentMatch() {
  searchMatches.forEach((el, idx) => {
    el.classList.remove('search-highlight-current');
    if (idx === currentMatchIndex) {
      el.classList.add('search-highlight-current');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function goToNextMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
  highlightCurrentMatch();
  searchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
}

function goToPrevMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
  highlightCurrentMatch();
  searchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
}

// Search event listeners
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(e.target.value);
  }, 150);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      goToPrevMatch();
    } else {
      goToNextMatch();
    }
  }
  if (e.key === 'Escape') {
    closeSearch();
  }
});

searchNext.addEventListener('click', goToNextMatch);
searchPrev.addEventListener('click', goToPrevMatch);
searchClose.addEventListener('click', closeSearch);
