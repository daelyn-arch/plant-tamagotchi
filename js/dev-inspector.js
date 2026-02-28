/**
 * Dev DOM Inspector — hover over any element to see its tag, id, classes, and text.
 * Toggle with the inspector button in dev panel, or press Ctrl+Shift+I (while dev panel is open).
 * Self-contained — drop this script into any project.
 */

(function () {
  let active = false;
  let tooltip = null;
  let highlighted = null;
  let outlineOrig = '';

  function createTooltip() {
    const el = document.createElement('div');
    el.id = 'devInspectorTooltip';
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '999999',
      pointerEvents: 'none',
      background: '#1a1a2e',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineHeight: '1.5',
      padding: '8px 10px',
      borderRadius: '4px',
      border: '1px solid #4ade80',
      maxWidth: '360px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      display: 'none',
    });
    document.body.appendChild(el);
    return el;
  }

  function describe(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (el.id === 'devInspectorTooltip') return null;

    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).join('.')
      : '';
    const selector = `${tag}${id}${classes}`;

    const lines = [`<${selector}>`];

    // Dimensions
    const rect = el.getBoundingClientRect();
    lines.push(`size: ${Math.round(rect.width)}×${Math.round(rect.height)}`);

    // Direct text content (not children's)
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ');
    if (directText) {
      const truncated = directText.length > 60 ? directText.slice(0, 57) + '...' : directText;
      lines.push(`text: "${truncated}"`);
    }

    // Key attributes
    const show = ['src', 'href', 'alt', 'title', 'type', 'name', 'value', 'placeholder', 'data-id', 'role', 'aria-label'];
    for (const attr of show) {
      if (el.hasAttribute(attr)) {
        let val = el.getAttribute(attr);
        if (val.length > 50) val = val.slice(0, 47) + '...';
        lines.push(`${attr}: "${val}"`);
      }
    }

    // Computed display/position if non-default
    const cs = getComputedStyle(el);
    if (cs.display !== 'block' && cs.display !== 'inline') lines.push(`display: ${cs.display}`);
    if (cs.position !== 'static') lines.push(`position: ${cs.position}`);

    return lines.join('\n');
  }

  function onMove(e) {
    if (!active || !tooltip) return;

    const target = e.target;
    if (target === tooltip) return;

    // Highlight
    if (highlighted && highlighted !== target) {
      highlighted.style.outline = outlineOrig;
    }
    outlineOrig = target.style.outline;
    target.style.outline = '2px solid #4ade80';
    highlighted = target;

    const info = describe(target);
    if (!info) {
      tooltip.style.display = 'none';
      return;
    }

    tooltip.textContent = info;
    tooltip.style.display = 'block';

    // Position near cursor, keep on screen
    let x = e.clientX + 14;
    let y = e.clientY + 14;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 8;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - 8;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function enable() {
    active = true;
    if (!tooltip) tooltip = createTooltip();
    document.addEventListener('mousemove', onMove, true);
    document.body.style.cursor = 'crosshair';
  }

  function disable() {
    active = false;
    if (highlighted) {
      highlighted.style.outline = outlineOrig;
      highlighted = null;
    }
    if (tooltip) tooltip.style.display = 'none';
    document.removeEventListener('mousemove', onMove, true);
    document.body.style.cursor = '';
  }

  function toggle() {
    if (active) disable();
    else enable();
    return active;
  }

  // Expose globally so dev panel button can call it
  window.__devInspectorToggle = toggle;
  window.__devInspectorActive = () => active;
})();
