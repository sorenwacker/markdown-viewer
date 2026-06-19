// View preferences persisted in localStorage: dark mode, A4/full-width view, and
// font size. Imported for its side effects — it initializes from storage and
// wires its own toggle controls at module load.
import {
  darkModeToggle, viewModeToggle, contentWrapper, fontIncreaseBtn, fontDecreaseBtn,
} from './dom.js';

// Dark mode
const updateDarkModeIcon = (isDark) => {
  const sunIcon = darkModeToggle.querySelector('.sun-icon');
  const moonIcon = darkModeToggle.querySelector('.moon-icon');
  if (isDark) {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
};

const initDarkMode = () => {
  const savedMode = localStorage.getItem('darkMode');
  if (savedMode === 'true') {
    document.body.classList.add('dark-mode');
    updateDarkModeIcon(true);
  }
};

darkModeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark);
  updateDarkModeIcon(isDark);
});

initDarkMode();

// View mode toggle (A4 vs Full Width)
const initViewMode = () => {
  const savedMode = localStorage.getItem('viewMode');
  if (savedMode === 'a4') {
    contentWrapper.classList.add('a4-mode');
  }
};

viewModeToggle.addEventListener('click', () => {
  const isA4 = contentWrapper.classList.toggle('a4-mode');
  localStorage.setItem('viewMode', isA4 ? 'a4' : 'full');
  viewModeToggle.title = isA4 ? 'Switch to Full Width' : 'Switch to A4 View';
});

initViewMode();

// Font size controls
const fontSizes = ['small', 'medium', 'large', 'xlarge'];
let fontSize = 'medium'; // small, medium, large, xlarge

const updateFontSize = () => {
  // Remove all font size classes
  fontSizes.forEach(size => {
    contentWrapper.classList.remove(`font-${size}`);
  });

  // Add current font size class (if not medium, which is default)
  if (fontSize !== 'medium') {
    contentWrapper.classList.add(`font-${fontSize}`);
  }

  // Update button states
  const currentIndex = fontSizes.indexOf(fontSize);
  fontDecreaseBtn.disabled = currentIndex === 0;
  fontIncreaseBtn.disabled = currentIndex === fontSizes.length - 1;

  fontDecreaseBtn.style.opacity = currentIndex === 0 ? '0.4' : '1';
  fontIncreaseBtn.style.opacity = currentIndex === fontSizes.length - 1 ? '0.4' : '1';
};

const initFontSize = () => {
  const savedSize = localStorage.getItem('fontSize') || 'medium';
  fontSize = savedSize;
  updateFontSize();
};

fontIncreaseBtn.addEventListener('click', () => {
  const currentIndex = fontSizes.indexOf(fontSize);
  if (currentIndex < fontSizes.length - 1) {
    fontSize = fontSizes[currentIndex + 1];
    localStorage.setItem('fontSize', fontSize);
    updateFontSize();
  }
});

fontDecreaseBtn.addEventListener('click', () => {
  const currentIndex = fontSizes.indexOf(fontSize);
  if (currentIndex > 0) {
    fontSize = fontSizes[currentIndex - 1];
    localStorage.setItem('fontSize', fontSize);
    updateFontSize();
  }
});

initFontSize();
