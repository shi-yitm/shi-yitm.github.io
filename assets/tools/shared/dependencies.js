export function requireGlobal(name, label = name) {
  const value = window[name];
  if (!value) throw new Error(`${label} 依赖加载失败，请刷新后重试`);
  return value;
}

export function configurePdfWorker() {
  const pdfjs = requireGlobal('pdfjsLib', 'PDF');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  return pdfjs;
}
