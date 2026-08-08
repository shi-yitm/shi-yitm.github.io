import { showToast } from './toast.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制');
    return true;
  } catch {
    showToast('复制失败');
    return false;
  }
}

export function copyElementText(element) {
  return copyText(element?.textContent || '');
}
