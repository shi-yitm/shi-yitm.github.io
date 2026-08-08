let timer;
export function showToast(message, duration = 1800) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  clearTimeout(timer);
  toast.textContent = message;
  toast.classList.add('show');
  timer = setTimeout(() => toast.classList.remove('show'), duration);
}
