import { requireGlobal } from '../shared/dependencies.js';
import { showToast } from '../shared/toast.js';

let initialized = false;

export function init() {
  if (initialized) return;
  initialized = true;
  const QRCode = requireGlobal('QRCode', '二维码');
  const root = document.querySelector('#tool-qrcode');
  const input = root.querySelector('#qrText');
  const host = root.querySelector('#qrCanvas');
  const hint = root.querySelector('#qrHint');
  function generate() {
    host.replaceChildren();
    const text = input.value.trim();
    hint.hidden = Boolean(text);
    if (!text) return;
    new QRCode(host, { text, width: 200, height: 200,
      colorDark: root.querySelector('#qrFg').value,
      colorLight: root.querySelector('#qrBg').value,
      correctLevel: QRCode.CorrectLevel.M });
    const canvas = host.querySelector('canvas');
    if (canvas) canvas.style.display = 'block';
  }
  input.oninput = generate;
  root.querySelector('#qrFg').oninput = generate;
  root.querySelector('#qrBg').oninput = generate;
  root.querySelector('[data-action="download-qr"]').onclick = () => {
    const canvas = host.querySelector('canvas');
    if (!canvas) return showToast('请先生成二维码');
    Object.assign(document.createElement('a'), { href: canvas.toDataURL('image/png'), download: 'qrcode.png' }).click();
  };
}
