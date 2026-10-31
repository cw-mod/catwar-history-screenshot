// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      1.3.1
// @description  Скриншот истории CatWar с бейджем времени по МСК
// @author       кошечка
// @match        https://catwar.su/cw3/*
// @match        https://catwar.su/cw3
// @match        https://catwar.su/
// @match        http://catwar.su/cw3/*
// @match        http://catwar.su/
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/cw-mod/catwar-history-screenshot/main/catwar-history-screenshot.user.js
// @downloadURL  https://raw.githubusercontent.com/cw-mod/catwar-history-screenshot/main/catwar-history-screenshot.user.js
// ==/UserScript==
(function () {
'use strict';

const GROUP_ID = 'cw-history-screenshot-group';
const GROUP_ID_FLAT = 'cw-history-screenshot-group-flat';
const CLOCK_BG = 'rgb(184, 170, 170)';
const CLOCK_TEXT = '#000000';
const TARGET_BG_COLOR = 'rgb(107, 86, 88)';

// Глобальный флаг захвата — защищает от параллельного запуска двух скриншотов,
// который ломал восстановление стилей и swapMultiFind/restoreMultiFind.
let isCapturing = false;

// ===== Утилиты =====

function getMoscowDate() {
  // Надёжное получение времени по Москве через Intl с таймзоной.
  // Часы/минуты/секунды берём из отформатированной строки, дата — из той же таймзоны.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type).value;
  return new Date(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')) === 24 ? 0 : Number(get('hour')),
    Number(get('minute')),
    Number(get('second'))
  );
}

function pad(n) { return String(n).padStart(2, '0'); }

function waitForElement(selector, callback, maxAttempts = 100) {
  let attempts = 0;
  const tick = () => {
    const el = document.querySelector(selector);
    if (el) return callback(el);
    if (++attempts < maxAttempts) setTimeout(tick, 200);
  };
  tick();
}

// ===== UI кнопок =====

function styleButton(btn, variant) {
  const isPrimary = variant === 'primary';
  const baseBg = isPrimary ? '#d0b690' : 'rgba(255, 255, 255, 0.45)';
  const baseColor = isPrimary ? '#ffffff' : '#09060D';
  const hoverBg = isPrimary ? '#b89c70' : 'rgba(255, 255, 255, 0.7)';
  btn.style.cssText = [
    'margin-left: 6px', 'padding: 2px 10px', 'font-size: 0.85em',
    'font-weight: 600', 'line-height: 1.4', 'cursor: pointer',
    'background: ' + baseBg, 'color: ' + baseColor,
    'border: 1px solid rgba(0, 0, 0, 0.16)', 'border-radius: 6px',
    'vertical-align: middle', 'user-select: none',
    'transition: background-color 0.15s ease, transform 0.08s ease, opacity 0.15s ease',
    'white-space: nowrap'
  ].join(';') + ';';
  btn.addEventListener('mouseenter', () => { if (!btn.disabled) btn.style.background = hoverBg; });
  btn.addEventListener('mouseleave', () => { if (!btn.disabled) { btn.style.background = baseBg; btn.style.transform = ''; } });
  btn.addEventListener('mousedown', () => { if (!btn.disabled) btn.style.transform = 'translateY(1px)'; });
  btn.addEventListener('mouseup', () => { btn.style.transform = ''; });
}

// ===== Штамп времени МСК на canvas =====

function drawClockStampOnCanvas(ctx, scale, targetRect, h2Rect) {
  const msk = getMoscowDate();
  const timeStr = `${pad(msk.getHours())}:${pad(msk.getMinutes())}:${pad(msk.getSeconds())}`;
  const dateStr = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${String(msk.getFullYear()).slice(-2)}`;
  const mainFont = Math.max(20, 28 * scale);
  const iconFont = Math.max(14, 14 * scale);
  const mskFont = Math.max(11, 14 * scale);
  const mainText = `${timeStr} ${dateStr}`;
  const iconChar = '\u{1F30D}\u{FE0E}';
  ctx.font = `${mainFont}px Arial`;
  const mainW = ctx.measureText(mainText).width;
  ctx.font = `${iconFont}px Arial`;
  const iconW = ctx.measureText(iconChar).width;
  ctx.font = `${mskFont}px Arial`;
  const mskW = ctx.measureText('MSK').width;
  const boxPad = 5 * scale;
  const gap = 6 * scale;
  const smallGap = 1 * scale;
  const rightColW = Math.max(iconW, mskW);
  const rightColH = iconFont + smallGap + mskFont;
  const contentH = Math.max(mainFont, rightColH);
  const boxW = boxPad + mainW + gap + rightColW + boxPad;
  const boxH = boxPad + contentH + boxPad;

  let boxX, boxY;
  // Естественная позиция — правее h2 (или link внутри h2).
  if (h2Rect) {
    const h2RightOnCanvas = (h2Rect.right - targetRect.left) * scale;
    const h2CenterYOnCanvas = ((h2Rect.top + h2Rect.bottom) / 2 - targetRect.top) * scale;
    const naturalX = h2RightOnCanvas + 8 * scale;
    const naturalY = h2CenterYOnCanvas - boxH / 2;
    // Если естественная позиция помещается — используем её.
    // Если нет — fallback в правый верхний угол canvas (не сдвигаем на текст!).
    if (naturalX + boxW <= ctx.canvas.width && naturalX >= 0 &&
        naturalY >= 4 * scale && naturalY + boxH <= ctx.canvas.height - 4 * scale) {
      boxX = naturalX;
      boxY = naturalY;
    } else {
      boxX = ctx.canvas.width - boxW - 10 * scale;
      boxY = 10 * scale;
    }
  } else {
    boxX = ctx.canvas.width - boxW - 10 * scale;
    boxY = 10 * scale;
  }
  // Финальная защита: если boxW больше canvas.width — всё равно рисуем,
  // но прижимаем к левому краю с минимальным отступом.
  if (boxX < 0) boxX = 4 * scale;
  if (boxX + boxW > ctx.canvas.width) boxX = Math.max(4 * scale, ctx.canvas.width - boxW - 4 * scale);

  const r = Math.min(10 * scale, boxW / 2, boxH / 2);
  ctx.fillStyle = CLOCK_BG;
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.lineTo(boxX + boxW - r, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
  ctx.lineTo(boxX + boxW, boxY + boxH - r);
  ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
  ctx.lineTo(boxX + r, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
  ctx.lineTo(boxX, boxY + r);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = CLOCK_TEXT;
  const contentTop = boxY + boxPad;
  const contentCenterY = contentTop + contentH / 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `${mainFont}px Arial`;
  ctx.fillText(mainText, boxX + boxPad, contentCenterY);
  const rightColX = boxX + boxPad + mainW + gap;
  const rightColCenterX = rightColX + rightColW / 2;
  const rightColTop = contentTop + (contentH - rightColH) / 2;
  ctx.textAlign = 'center';
  ctx.font = `${iconFont}px Arial`;
  ctx.fillText(iconChar, rightColCenterX, rightColTop + iconFont / 2);
  ctx.font = `${mskFont}px Arial`;
  ctx.fillText('MSK', rightColCenterX, rightColTop + iconFont + smallGap + mskFont / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ===== multi-find swap (для совместимости с расширением) =====

function swapMultiFind(root) {
  const targets = Array.from(root.querySelectorAll('multi-find-1-extension'));
  const saved = [];
  targets.forEach(original => {
    const parent = original.parentNode;
    const next = original.nextSibling;
    const span = document.createElement('span');
    // Сохраняем ВСЕ inline-стили оригинала (display, padding, border-radius, box-shadow),
    // а не только background-color и color. Иначе подсветка расплывается по строкам:
    // оригинал мог быть display:inline-block с padding, что давало аккуратный прямоугольник.
    let inlineCss = original.style.cssText || '';
    // Гарантируем видимые цвета: если inline не задан — берём из getComputedStyle,
    // чтобы захватить стили из CSS-классов расширения.
    const cs = getComputedStyle(original);
    const bg = original.style.backgroundColor || cs.backgroundColor || 'transparent';
    const color = original.style.color || cs.color || 'inherit';
    // Если в inline-стиле не было display — ставим inline-block как безопасный дефолт
    // (сохраняет прямоугольную форму подсветки на одной строке).
    if (!/display\s*:/.test(inlineCss)) {
      inlineCss += (inlineCss && !/;\s*$/.test(inlineCss) ? ';' : '') + 'display:inline-block';
    }
    // Явно прописываем цвета, чтобы sanitizeClone их увидел через [style].
    inlineCss += ';background-color:' + bg + ';color:' + color;
    span.style.cssText = inlineCss;
    span.textContent = original.textContent;
    parent.replaceChild(span, original);
    saved.push({ parent: parent, original: original, span: span, next: next });
  });
  return { saved: saved };
}

function restoreMultiFind(data) {
  if (!data || !data.saved) return;
  data.saved.forEach(item => {
    try {
      if (item.span.parentNode === item.parent) {
        item.parent.replaceChild(item.original, item.span);
      } else if (item.next && item.next.parentNode === item.parent) {
        item.parent.insertBefore(item.original, item.next);
      } else {
        item.parent.appendChild(item.original);
      }
    } catch (e) {}
  });
}

// ===== Sanitize clone: убираем неподдерживаемые CSS color functions =====

const UNSUPPORTED_COLOR_FUNCS = ['color(', 'oklch(', 'oklab(', 'lab(', 'lch(', 'hwb('];
const COLOR_PROPS_KEBAB = ['background-color','color','border-top-color','border-right-color','border-bottom-color','border-left-color','border-color','outline-color','text-decoration-color','fill','stroke','box-shadow','caret-color'];

function sanitizeClone(clonedDoc, rootEl) {
  const win = clonedDoc.defaultView;
  rootEl.style.setProperty('background-color', TARGET_BG_COLOR, 'important');
  if (!win) return;
  // Оптимизация: проверяем только элементы с inline-стилем (style-атрибутом),
  // а не все элементы дерева. getComputedStyle на тысячах узлов дорого.
  const candidates = [];
  if (rootEl.hasAttribute && rootEl.hasAttribute('style')) candidates.push(rootEl);
  // querySelectorAll('style, [style]') — быстро, фильтрует по атрибуту, а не по дереву.
  candidates.push(...rootEl.querySelectorAll('[style]'));
  candidates.forEach(el => {
    let cs;
    try { cs = win.getComputedStyle(el); } catch (e) { return; }
    COLOR_PROPS_KEBAB.forEach(prop => {
      let val;
      try { val = cs.getPropertyValue(prop); } catch (e) { return; }
      if (!val) return;
      const lower = val.toLowerCase();
      if (!UNSUPPORTED_COLOR_FUNCS.some(p => lower.includes(p))) return;
      let safe;
      if (prop === 'background-color') safe = 'rgba(184, 170, 170, 0.55)';
      else if (prop === 'box-shadow') safe = 'none';
      else safe = CLOCK_BG;
      el.style.setProperty(prop, safe, 'important');
    });
  });
}

// ===== File System Access API + IndexedDB persist =====

let _dirHandle = null;

function idbGet(key) {
  return new Promise((resolve) => {
    const req = indexedDB.open('cw_screenshot', 1);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore('store'); };
    req.onsuccess = (e) => { const db = e.target.result; const tx = db.transaction('store', 'readonly'); const r = tx.objectStore('store').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); };
    req.onerror = () => resolve(null);
  });
}

function idbSet(key, value) {
  return new Promise((resolve) => {
    const req = indexedDB.open('cw_screenshot', 1);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore('store'); };
    req.onsuccess = (e) => { const db = e.target.result; const tx = db.transaction('store', 'readwrite'); tx.objectStore('store').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); };
    req.onerror = () => resolve();
  });
}

async function getDirHandle() {
  if (_dirHandle) {
    const perm = await _dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return _dirHandle;
    const req = await _dirHandle.requestPermission({ mode: 'readwrite' });
    if (req === 'granted') return _dirHandle;
  }
  const saved = await idbGet('dir');
  if (saved) {
    const perm = await saved.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') { _dirHandle = saved; return saved; }
    const req = await saved.requestPermission({ mode: 'readwrite' });
    if (req === 'granted') { _dirHandle = saved; return saved; }
  }
  if (!window.showDirectoryPicker) return null;
  const handle = await window.showDirectoryPicker();
  await idbSet('dir', handle);
  _dirHandle = handle;
  return handle;
}

async function saveBlobToDir(blob, filename) {
  const dir = await getDirHandle();
  if (!dir) return false;
  const fh = await dir.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

// ===== Сохранение =====

function downloadCanvas(canvas, modeSlug, onDone, onFail) {
  const msk = getMoscowDate();
  const stamp = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()}_${pad(msk.getHours())}-${pad(msk.getMinutes())}-${pad(msk.getSeconds())}`;
  const filename = `история_${modeSlug}_${stamp}_МСК.png`;
  canvas.toBlob(async function (blob) {
    if (!blob) { onFail('Не удалось собрать PNG.'); return; }
    try {
      const saved = await saveBlobToDir(blob, filename);
      if (saved) { onDone(filename); return; }
    } catch (e) {}
    // Fallback на обычный download.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onDone(filename);
  }, 'image/png');
}

// ===== Главный обработчик =====

function takeScreenshot(btn, mode) {
  if (isCapturing) return; // защита от параллельного запуска
  const target = document.querySelector('td#history') || document.querySelector('#history');
  if (!target) { alert('Блок «История» не найден.'); return; }
  if (typeof window.html2canvas !== 'function') { alert('html2canvas не загружен.'); return; }

  const originalLabel = btn.textContent;
  const originalDisabled = btn.disabled;
  btn.disabled = true;
  btn.textContent = '⏳ Делаю скриншот…';
  isCapturing = true;

  const scale = Math.min(window.devicePixelRatio || 1.5, 2);
  const group = document.getElementById(GROUP_ID) || document.getElementById(GROUP_ID_FLAT);
  const savedGroupDisplay = group ? group.style.display : null;
  if (group) group.style.display = 'none';

  const historyBlock = target.querySelector('#history_block');
  const h2El = target.querySelector('h2');
  const h2Link = h2El ? h2El.querySelector('a') : null;
  const targetRect = target.getBoundingClientRect();
  const h2FullRect = h2El ? h2El.getBoundingClientRect() : null;
  const h2LinkRect = h2Link ? h2Link.getBoundingClientRect() : h2FullRect;
  const visibleClientHeight = targetRect.height;
  const tdPb = parseInt(getComputedStyle(target).paddingBottom) || 0;
  const tdBb = parseInt(getComputedStyle(target).borderBottomWidth) || 0;
  const effVisH = visibleClientHeight - tdPb - tdBb;
  const h2OffsetInTarget = h2FullRect ? (h2FullRect.top - targetRect.top) : 0;
  const h2Height = h2FullRect ? h2FullRect.height : 0;
  const scrollTop = historyBlock ? historyBlock.scrollTop : 0;

  let savedBlockStyles = null;
  if (historyBlock) {
    savedBlockStyles = {
      height: historyBlock.style.height,
      maxHeight: historyBlock.style.maxHeight,
      overflow: historyBlock.style.overflow,
      overflowY: historyBlock.style.overflowY,
      overflowX: historyBlock.style.overflowX,
      resize: historyBlock.style.resize
    };
    historyBlock.style.height = 'auto';
    historyBlock.style.maxHeight = 'none';
    historyBlock.style.overflow = 'visible';
    historyBlock.style.overflowY = 'visible';
    historyBlock.style.overflowX = 'visible';
    historyBlock.style.resize = 'none';
    void historyBlock.offsetHeight; // force reflow
  }

  const mfData = swapMultiFind(target);

  const captureWidth = target.scrollWidth || target.offsetWidth;
  const captureHeight = target.offsetHeight;
  const cropH = Math.min(effVisH, captureHeight);

  // Проверка: в режиме 'visible' есть ли что захватывать, кроме заголовка?
  if (mode === 'visible' && cropH <= h2OffsetInTarget + h2Height) {
    // Восстанавливаем состояние до alert.
    if (savedBlockStyles && historyBlock) {
      historyBlock.style.height = savedBlockStyles.height;
      historyBlock.style.maxHeight = savedBlockStyles.maxHeight;
      historyBlock.style.overflow = savedBlockStyles.overflow;
      historyBlock.style.overflowY = savedBlockStyles.overflowY;
      historyBlock.style.overflowX = savedBlockStyles.overflowX;
      historyBlock.style.resize = savedBlockStyles.resize;
    }
    if (group) group.style.display = savedGroupDisplay;
    if (mfData) restoreMultiFind(mfData);
    isCapturing = false;
    btn.disabled = originalDisabled;
    btn.textContent = originalLabel;
    alert('Видимая часть истории пуста. Прокрутите блок вниз или используйте режим «Вся история».');
    return;
  }

  const baseOptions = {
    backgroundColor: '#ffffff',
    scale: scale,
    useCORS: true,
    allowTaint: false, // исправлено: ранее true приводило к tainted canvas
    logging: false,
    width: captureWidth,
    height: captureHeight,
    scrollX: 0,
    scrollY: 0,
    windowWidth: document.documentElement.clientWidth,
    onclone: function (clonedDoc, element) {
      const clonedTarget = element || clonedDoc.querySelector('td#history');
      if (!clonedTarget) return;
      try { sanitizeClone(clonedDoc, clonedTarget); } catch (e) { console.warn('[CatWar Screenshot] sanitizeClone:', e); }
    }
  };

  function cleanup() {
    if (savedBlockStyles && historyBlock) {
      historyBlock.style.height = savedBlockStyles.height;
      historyBlock.style.maxHeight = savedBlockStyles.maxHeight;
      historyBlock.style.overflow = savedBlockStyles.overflow;
      historyBlock.style.overflowY = savedBlockStyles.overflowY;
      historyBlock.style.overflowX = savedBlockStyles.overflowX;
      historyBlock.style.resize = savedBlockStyles.resize;
    }
    if (group) group.style.display = savedGroupDisplay;
    if (mfData) restoreMultiFind(mfData);
    isCapturing = false;
  }

  function finalize(rawCanvas) {
    cleanup();
    let finalCanvas = rawCanvas;
    if (mode === 'visible') {
      try {
        const s = scale;
        const upperEnd = Math.round((h2OffsetInTarget + h2Height) * s);
        const histSrcY = Math.round((h2OffsetInTarget + h2Height + scrollTop) * s);
        const histSrcH = Math.max(0, Math.round((cropH - h2OffsetInTarget - h2Height) * s));
        const newCanvas = document.createElement('canvas');
        newCanvas.width = rawCanvas.width;
        newCanvas.height = Math.round(cropH * s);
        const ctx = newCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        if (upperEnd > 0) ctx.drawImage(rawCanvas, 0, 0, rawCanvas.width, upperEnd, 0, 0, rawCanvas.width, upperEnd);
        if (histSrcH > 0) ctx.drawImage(rawCanvas, 0, histSrcY, rawCanvas.width, histSrcH, 0, upperEnd, rawCanvas.width, histSrcH);

        // Обрезка нижнего whitespace. lastY = -1 — sentinel "не найдено".
        try {
          const imgData = ctx.getImageData(0, 0, newCanvas.width, newCanvas.height);
          let lastY = -1;
          for (let y = newCanvas.height - 1; y >= 0; y--) {
            const row = y * newCanvas.width * 4;
            for (let x = 0; x < newCanvas.width; x++) {
              const i = row + x * 4;
              if (imgData.data[i] < 240 || imgData.data[i+1] < 240 || imgData.data[i+2] < 240) { lastY = y; break; }
            }
            if (lastY >= 0) break;
          }
          if (lastY >= 0 && lastY < newCanvas.height - 1) {
            const trimmed = document.createElement('canvas');
            trimmed.width = newCanvas.width;
            trimmed.height = lastY + 2;
            const tctx = trimmed.getContext('2d');
            tctx.drawImage(newCanvas, 0, 0);
            finalCanvas = trimmed;
          } else {
            finalCanvas = newCanvas;
          }
        } catch (e) { finalCanvas = newCanvas; }
      } catch (e) { console.warn('[CatWar Screenshot] visible crop:', e); }
    }
    // В режиме 'full' рисуем штамп прямо на rawCanvas.
    // Контекст может быть null только если canvas уже использовался для willReadFrequently
    // с другим контекстом — маловероятно, но проверяем.
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) {
      console.error('[CatWar Screenshot] Не удалось получить 2d context для штампа МСК');
    } else {
      try {
        drawClockStampOnCanvas(finalCtx, scale, targetRect, h2LinkRect);
      } catch (e) {
        console.error('[CatWar Screenshot] drawClockStampOnCanvas упал:', e);
      }
    }

    downloadCanvas(
      finalCanvas,
      mode === 'visible' ? 'видимое' : 'полная',
      function (filename) {
        btn.textContent = '✅ Сохранено!';
        setTimeout(() => { btn.textContent = originalLabel; btn.disabled = originalDisabled; }, 1500);
      },
      function (errMsg) {
        alert(errMsg);
        btn.textContent = originalLabel;
        btn.disabled = originalDisabled;
      }
    );
  }

  function fail(err) {
    cleanup();
    alert('Не удалось сделать скриншот:\n' + (err && err.message ? err.message : err));
    btn.textContent = originalLabel;
    btn.disabled = originalDisabled;
  }

  window.html2canvas(target, baseOptions).then(finalize).catch(fail);
}

// ===== Создание UI =====

function buildGroup() {
  const group = document.createElement('span');
  group.id = GROUP_ID;
  group.style.cssText = 'display: inline-flex; align-items: center; gap: 0; margin-left: 10px; vertical-align: middle;';
  const btnFull = document.createElement('button');
  btnFull.type = 'button'; btnFull.textContent = '📸 Вся история'; btnFull.title = 'Скриншот всей истории.';
  styleButton(btnFull, 'primary'); btnFull.addEventListener('click', () => takeScreenshot(btnFull, 'full'));
  const btnVisible = document.createElement('button');
  btnVisible.type = 'button'; btnVisible.textContent = '👁 Видимое'; btnVisible.title = 'Скриншот видимой части.';
  styleButton(btnVisible, 'secondary'); btnVisible.addEventListener('click', () => takeScreenshot(btnVisible, 'visible'));
  group.appendChild(btnFull); group.appendChild(btnVisible);
  return group;
}

function ensureButton() {
  if (document.getElementById(GROUP_ID) || document.getElementById(GROUP_ID_FLAT)) return;
  const historyTd = document.querySelector('td#history');
  if (historyTd) {
    const h2 = historyTd.querySelector('h2');
    if (h2 && !h2.querySelector('#' + GROUP_ID)) { h2.appendChild(buildGroup()); return; }
  }
  const historyBlock = document.querySelector('#history_block');
  if (historyBlock && !historyBlock.querySelector('#' + GROUP_ID_FLAT)) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin: 0 0 6px 0; text-align: right;';
    const g = buildGroup(); g.id = GROUP_ID_FLAT;
    wrapper.appendChild(g);
    historyBlock.insertBefore(wrapper, historyBlock.firstChild);
  }
}

// ===== Наблюдение за появлением кнопки =====
// Без 2-секундного setInterval — только MutationObserver с debounce.

let ensureDebounce = null;
function scheduleEnsure() {
  if (ensureDebounce) return;
  ensureDebounce = setTimeout(() => {
    ensureDebounce = null;
    if (!document.getElementById(GROUP_ID) && !document.getElementById(GROUP_ID_FLAT)) {
      ensureButton();
    }
  }, 150);
}

// Сначала ждём появления #history_block или td#history, потом навешиваем
// узкий observer уже на сам блок, а не на document.body целиком.
waitForElement('#history_block, td#history', function () {
  ensureButton();
  const observerTarget = document.querySelector('td#history') || document.getElementById('history_block') || document.body;
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(observerTarget, { childList: true, subtree: true });
});

})();
