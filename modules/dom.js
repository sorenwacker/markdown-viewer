// Cached references to the renderer's DOM elements, queried once at module load.
// Centralizing them here keeps the feature modules free of repeated lookups and
// gives a single place to see every element the renderer depends on.
export const sidebar = document.getElementById('sidebar');
export const sidebarToggleMain = document.getElementById('sidebarToggleMain');
export const openFileBtn = document.getElementById('openFileBtn');
export const openFolderBtn = document.getElementById('openFolderBtn');
export const welcomeOpenFileBtn = document.getElementById('welcomeOpenFileBtn');
export const welcomeOpenFolderBtn = document.getElementById('welcomeOpenFolderBtn');
export const treeContainer = document.getElementById('treeContainer');
export const outlineContainer = document.getElementById('outlineContainer');
export const welcomeScreen = document.getElementById('welcomeScreen');
export const markdownContent = document.getElementById('markdownContent');
export const fileInfo = document.getElementById('fileInfo');
export const filesTab = document.getElementById('filesTab');
export const outlineTab = document.getElementById('outlineTab');
export const darkModeToggle = document.getElementById('darkModeToggle');
export const folderPath = document.getElementById('folderPath');
export const viewModeToggle = document.getElementById('viewModeToggle');
export const fontIncreaseBtn = document.getElementById('fontIncreaseBtn');
export const fontDecreaseBtn = document.getElementById('fontDecreaseBtn');
export const reloadBtn = document.getElementById('reloadBtn');
export const copySourceBtn = document.getElementById('copySourceBtn');
export const contentWrapper = document.querySelector('.content-wrapper');
export const searchBar = document.getElementById('searchBar');
export const searchInput = document.getElementById('searchInput');
export const searchCount = document.getElementById('searchCount');
export const searchPrev = document.getElementById('searchPrev');
export const searchNext = document.getElementById('searchNext');
export const searchClose = document.getElementById('searchClose');
export const supportLink = document.getElementById('supportLink');
export const tabBar = document.getElementById('tabBar');
export const tabBarContent = document.getElementById('tabBarContent');
