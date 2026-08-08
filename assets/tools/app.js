const modules = {
  'image-converter': () => import('./modules/image-converter.js'),
  'json-csv': () => import('./modules/json-csv.js'),
  'color-converter': () => import('./modules/color-converter.js'),
  'timestamp': () => import('./modules/timestamp.js'),
  'markdown': () => import('./modules/markdown.js'),
  'base64': () => import('./modules/base64.js'),
  'docx-html': () => import('./modules/docx-html.js'),
  'images-pdf': () => import('./modules/images-pdf.js'),
  'pdf-images': () => import('./modules/pdf-images.js'),
  'qrcode': () => import('./modules/qrcode.js'),
  'sensitivity-lab': () => import('./modules/sensitivity-lab.js')
};
const initialized = new Set();
import { copyElementText, copyText } from './shared/clipboard.js';

export async function openTool(id) {
  const section = document.querySelector(`#tool-${id}`);
  if (!section || !modules[id]) return;
  document.querySelector('#toolList').hidden = true;
  document.querySelectorAll('.tool-section').forEach((element) => element.classList.toggle('active', element === section));
  if (!initialized.has(id)) {
    const module = await modules[id]();
    module.init();
    initialized.add(id);
  }
  window.scrollTo(0, 0);
}

export function showList() {
  document.querySelectorAll('.tool-section').forEach((element) => element.classList.remove('active'));
  document.querySelector('#toolList').hidden = false;
  window.scrollTo(0, 0);
}

document.querySelector('#toolList').addEventListener('click', (event) => {
  const card = event.target.closest('[data-tool]');
  if (card) openTool(card.dataset.tool);
});
document.querySelector('main').addEventListener('click', (event) => {
  if (event.target.closest('.back-btn')) showList();
  const textTarget=event.target.closest('[data-copy]');
  if(textTarget) copyElementText(document.getElementById(textTarget.dataset.copy));
  const valueTarget=event.target.closest('[data-copy-value]');
  if(valueTarget) copyText(document.getElementById(valueTarget.dataset.copyValue)?.value||'');
});

const nav = document.querySelector('.nav-links');
const menuToggle = document.querySelector('.menu-toggle');
menuToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  menuToggle.setAttribute('aria-expanded', String(nav.classList.toggle('is-open')));
});
document.addEventListener('click', (event) => {
  if (innerWidth <= 720 && !nav?.contains(event.target) && !menuToggle?.contains(event.target)) {
    nav?.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
});

const themeKey = 'blog-theme';
const themeButton = document.querySelector('.theme-toggle');
const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  if (themeButton) themeButton.textContent = theme === 'dark' ? '☀️' : '🌙';
};
applyTheme(localStorage.getItem(themeKey) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeButton?.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  localStorage.setItem(themeKey, theme);
});

window.toolsApp = { openTool, showList };
