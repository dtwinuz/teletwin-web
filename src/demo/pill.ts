// Demo badge in the bottom-right corner of every screen. Two short lines, so on a desktop it fits in the free space
// right of the chat column and never covers the composer buttons; it lets clicks through.
const TITLE = 'Demo · namuna ma\'lumotlar';
const SUBTITLE = 'qayta yuklanganda tiklanadi';
const NARROW_WIDTH = 700;

export function mountDemoPill() {
  const mount = () => {
    const isNarrow = window.innerWidth < NARROW_WIDTH;
    const pill = document.createElement('div');
    pill.className = 'tt-demo-pill';
    pill.setAttribute('role', 'note');
    pill.title = `${TITLE}, ${SUBTITLE}`;
    pill.style.cssText = [
      'position:fixed', 'right:8px', `bottom:${isNarrow ? 64 : 10}px`, 'z-index:2147483000', 'display:flex',
      'align-items:center', 'gap:8px', 'padding:6px 12px 6px 10px', 'border-radius:14px', 'max-width:186px',
      'font:600 11px/1.3 system-ui,sans-serif', 'color:#fff', 'background:rgba(20,27,45,.82)',
      'box-shadow:0 6px 20px rgba(0,0,0,.22)', 'backdrop-filter:blur(6px)', 'pointer-events:none',
    ].join(';');
    const dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#38c98a;flex:none';
    const text = document.createElement('span');
    text.innerHTML = '<span></span><br><span style="font-weight:500;opacity:.8"></span>';
    const [title, , subtitle] = text.children;
    title.textContent = isNarrow ? 'Demo' : TITLE;
    subtitle.textContent = isNarrow ? 'namuna ma\'lumotlar' : SUBTITLE;
    pill.append(dot, text);
    document.body.append(pill);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
}
