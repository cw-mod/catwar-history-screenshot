// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      1.2.2
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
// ==/UserScript==

(function () {
    'use strict';

    const GROUP_ID = 'cw-history-screenshot-group';
    const GROUP_ID_FLAT = 'cw-history-screenshot-group-flat';
    const CLOCK_BG = 'rgb(184, 170, 170)';
    const CLOCK_TEXT = '#000000';
    const TARGET_BG_COLOR = 'rgb(107, 86, 88)';

    function getMoscowDate() {
        const now = new Date();
        const moscowMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 60 * 60000);
        return new Date(moscowMs);
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
        if (h2Rect) {
            const h2RightOnCanvas = (h2Rect.right - targetRect.left) * scale;
            const h2CenterYOnCanvas = ((h2Rect.top + h2Rect.bottom) / 2 - targetRect.top) * scale;
            boxX = h2RightOnCanvas + 8 * scale;
            boxY = h2CenterYOnCanvas - boxH / 2;
        } else {
            boxX = ctx.canvas.width - boxW - 10 * scale;
            boxY = 10 * scale;
        }
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

    const UNSUPPORTED_COLOR_FUNCS = ['color(', 'oklch(', 'oklab(', 'lab(', 'lch(', 'hwb('];
    const COLOR_PROPS_KEBAB = ['background-color','color','border-top-color','border-right-color','border-bottom-color','border-left-color','border-color','outline-color','text-decoration-color','fill','stroke','box-shadow','caret-color'];

    function sanitizeClone(clonedDoc, rootEl) {
        const win = clonedDoc.defaultView;

        try {
            const count = replaceMultiFindInClone(clonedDoc, rootEl);
        } catch (e) {}

        rootEl.style.setProperty('background-color', TARGET_BG_COLOR, 'important');

        if (!win) return;
        const elements = [rootEl, ...rootEl.querySelectorAll('*')];
        elements.forEach(el => {
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

    function replaceMultiFindInClone(clonedDoc, rootEl) {
        let targets = rootEl.querySelectorAll('multi-find-1-extension');
        if (targets.length === 0) {
            targets = [];
            const all = rootEl.getElementsByTagName('*');
            for (let i = 0; i < all.length; i++) {
                if (all[i].tagName && all[i].tagName.toLowerCase() === 'multi-find-1-extension') targets.push(all[i]);
            }
        }
        let count = 0;
        targets.forEach(original => {
            let inlineBg = original.style.backgroundColor;
            let inlineColor = original.style.color;
            if ((!inlineBg || !inlineColor)) {
                try {
                    const cs = clonedDoc.defaultView.getComputedStyle(original);
                    if (!inlineBg) inlineBg = cs.backgroundColor;
                    if (!inlineColor) inlineColor = cs.color;
                } catch (e) {}
            }
            const wordCss = `background-color: ${inlineBg || 'transparent'}; color: ${inlineColor || 'inherit'}; display: inline-block; padding: 0; margin: 0; line-height: inherit;`;
            const spaceCss = `display: inline-block; background: transparent;`;
            const fragment = clonedDoc.createDocumentFragment();
            const text = original.textContent || '';
            const parts = text.split(/(\s+)/);
            parts.forEach(part => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    const s = clonedDoc.createElement('span');
                    s.style.cssText = spaceCss;
                    s.textContent = part;
                    fragment.appendChild(s);
                } else {
                    const s = clonedDoc.createElement('span');
                    s.style.cssText = wordCss;
                    s.textContent = part;
                    fragment.appendChild(s);
                }
            });
            if (original.parentNode) {
                original.parentNode.replaceChild(fragment, original);
                count++;
            }
        });
        return count;
    }

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

    function downloadCanvas(canvas, modeSlug) {
        const msk = getMoscowDate();
        const stamp = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()}_${pad(msk.getHours())}-${pad(msk.getMinutes())}-${pad(msk.getSeconds())}`;
        const filename = `история_${modeSlug}_${stamp}_МСК.png`;
        canvas.toBlob(async function (blob) {
            if (!blob) { alert('Не удалось собрать PNG.'); return; }
            try { const saved = await saveBlobToDir(blob, filename); if (saved) return; } catch (e) {}
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, 'image/png');
    }

    function takeScreenshot(btn, mode) {
        const target = document.querySelector('td#history') || document.querySelector('#history');
        if (!target) { alert('Блок «История» не найден.'); return; }
        if (typeof window.html2canvas !== 'function') { alert('html2canvas не загружен.'); return; }
        const originalLabel = btn.textContent;
        const originalDisabled = btn.disabled;
        btn.disabled = true;
        btn.textContent = '⏳ Делаю скриншот…';
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
            savedBlockStyles = { height: historyBlock.style.height, maxHeight: historyBlock.style.maxHeight, overflow: historyBlock.style.overflow, overflowY: historyBlock.style.overflowY, overflowX: historyBlock.style.overflowX, resize: historyBlock.style.resize };
            historyBlock.style.height = 'auto'; historyBlock.style.maxHeight = 'none'; historyBlock.style.overflow = 'visible'; historyBlock.style.overflowY = 'visible'; historyBlock.style.overflowX = 'visible'; historyBlock.style.resize = 'none';
            void historyBlock.offsetHeight;
        }

        const mfStyle = document.createElement('style');
        mfStyle.textContent = 'multi-find-1-extension{display:inline!important}';
        document.head.appendChild(mfStyle);

        const captureWidth = target.scrollWidth || target.offsetWidth;
        const captureHeight = target.offsetHeight;
        const cropH = Math.min(effVisH, captureHeight);

        const baseOptions = {
            backgroundColor: '#ffffff', scale: scale, useCORS: true, allowTaint: true,
            logging: false, width: captureWidth, height: captureHeight, scrollX: 0, scrollY: 0,
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
            if (mfStyle) mfStyle.remove();
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
                    try {
                        const imgData = ctx.getImageData(0, 0, newCanvas.width, newCanvas.height);
                        let lastY = 0;
                        for (let y = newCanvas.height - 1; y >= 0; y--) {
                            const row = y * newCanvas.width * 4;
                            for (let x = 0; x < newCanvas.width; x++) {
                                const i = row + x * 4;
                                if (imgData.data[i] < 240 || imgData.data[i+1] < 240 || imgData.data[i+2] < 240) { lastY = y; break; }
                            }
                            if (lastY) break;
                        }
                        if (lastY > 0 && lastY < newCanvas.height - 1) {
                            const trimmed = document.createElement('canvas');
                            trimmed.width = newCanvas.width;
                            trimmed.height = lastY + 2;
                            const tctx = trimmed.getContext('2d');
                            tctx.drawImage(newCanvas, 0, 0);
                            finalCanvas = trimmed;
                        } else { finalCanvas = newCanvas; }
                    } catch (e) { finalCanvas = newCanvas; }
                } catch (e) { console.warn('[CatWar Screenshot] visible crop:', e); }
            } else {
                try {
                    const copyCanvas = document.createElement('canvas');
                    copyCanvas.width = rawCanvas.width;
                    copyCanvas.height = rawCanvas.height;
                    const copyCtx = copyCanvas.getContext('2d');
                    copyCtx.drawImage(rawCanvas, 0, 0);
                    finalCanvas = copyCanvas;
                } catch (e) {}
            }
            try {
                const finalCtx = finalCanvas.getContext('2d');
                drawClockStampOnCanvas(finalCtx, scale, targetRect, h2LinkRect);
            } catch (e) {}
            downloadCanvas(finalCanvas, mode === 'visible' ? 'видимое' : 'полная');
            btn.textContent = '✅ Сохранено!';
            setTimeout(() => { btn.textContent = originalLabel; btn.disabled = originalDisabled; }, 1500);
        }

        function fail(err) {
            cleanup();
            alert('Не удалось сделать скриншот:\n' + (err && err.message ? err.message : err));
            btn.textContent = originalLabel;
            btn.disabled = originalDisabled;
        }

        window.html2canvas(target, baseOptions)
            .then(finalize)
            .catch(function (err1) {
                const opts2 = Object.assign({}, baseOptions, { allowTaint: false });
                window.html2canvas(target, opts2).then(finalize).catch(fail);
            });
    }

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
        if (historyTd) { const h2 = historyTd.querySelector('h2'); if (h2 && !h2.querySelector('#' + GROUP_ID)) { h2.appendChild(buildGroup()); return; } }
        const historyBlock = document.querySelector('#history_block');
        if (historyBlock && !historyBlock.querySelector('#' + GROUP_ID_FLAT)) { const wrapper = document.createElement('div'); wrapper.style.cssText = 'margin: 0 0 6px 0; text-align: right;'; const g = buildGroup(); g.id = GROUP_ID_FLAT; wrapper.appendChild(g); historyBlock.insertBefore(wrapper, historyBlock.firstChild); }
    }

    waitForElement('#history_block', ensureButton);
    waitForElement('td#history', ensureButton);
    const observerTarget = document.getElementById('app') || document.body;
    const observer = new MutationObserver(function () { if (!document.getElementById(GROUP_ID) && !document.getElementById(GROUP_ID_FLAT)) ensureButton(); });
    observer.observe(observerTarget, { childList: true, subtree: true });
    setInterval(function () { if (!document.getElementById(GROUP_ID) && !document.getElementById(GROUP_ID_FLAT)) ensureButton(); }, 2000);
})();
