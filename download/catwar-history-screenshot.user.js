// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      5.0
// @description  Кнопки «📸 Вся история» и «👁 Видимое» в блоке «История» на Игровой CatWar. Над скриншотом сверху по центру — скруглённая коробочка в стиле часов UwU с подложкой из игры: «02:05:44 31.10.26 🌍 MSK» (всё по МСК).
// @author       z.ai
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

    // =========================================================================
    //  Время по МСК (UTC+3)
    // =========================================================================

    function getMoscowDate() {
        const now = new Date();
        const moscowMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 60 * 60000);
        return new Date(moscowMs);
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function waitForElement(selector, callback, maxAttempts = 100) {
        let attempts = 0;
        const tick = () => {
            const el = document.querySelector(selector);
            if (el) return callback(el);
            if (++attempts < maxAttempts) setTimeout(tick, 200);
        };
        tick();
    }

    // =========================================================================
    //  Цвет подложки из игры (как у часов UwU — blocksColor, не subBlocksColor)
    // =========================================================================

    // Любой rgba/rgb/hex → непрозрачный rgb() (композит поверх белого)
    function normalizeToOpaque(bg) {
        if (!bg) return null;
        const s = String(bg).trim();
        const m = s.match(/rgba?\(([^)]+)\)/i);
        if (m) {
            const parts = m[1].split(',').map(v => parseFloat(v.trim()));
            const r = parts[0] | 0, g = parts[1] | 0, b = parts[2] | 0;
            const a = parts.length > 3 ? parts[3] : 1;
            const cr = Math.round(r * a + 255 * (1 - a));
            const cg = Math.round(g * a + 255 * (1 - a));
            const cb = Math.round(b * a + 255 * (1 - a));
            return { r: cr, g: cg, b: cb, css: `rgb(${cr}, ${cg}, ${cb})` };
        }
        if (s.charAt(0) === '#') {
            let hex = s.slice(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length === 6) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
            }
        }
        return null;
    }

    // Берём blocksColor (внешний блок), как это делают часы UwU.
    // Порядок: --cw3-page-bg → #tr_actions > td → #history_block → fallback.
    function getGameSubstrateColor() {
        const tries = [];

        try {
            const rootCs = getComputedStyle(document.documentElement);
            const v = rootCs.getPropertyValue('--cw3-page-bg').trim();
            if (v) tries.push(v);
        } catch (e) {}

        const outerEl = document.querySelector('#tr_actions > td') ||
                        document.querySelector('#tr_actions') ||
                        document.querySelector('#tr_mouth > td') ||
                        document.querySelector('#tr_tos > td');
        if (outerEl) {
            try { tries.push(getComputedStyle(outerEl).backgroundColor); } catch (e) {}
        }

        const subEl = document.querySelector('#history_block') ||
                      document.querySelector('td#history');
        if (subEl) {
            try { tries.push(getComputedStyle(subEl).backgroundColor); } catch (e) {}
        }

        for (const raw of tries) {
            const norm = normalizeToOpaque(raw);
            if (norm) return norm;
        }
        return { r: 0xb8, g: 0xaa, b: 0xaa, css: 'rgb(184, 170, 170)' };
    }

    function getLuminance(rgbObj) {
        if (!rgbObj) return 0.5;
        const r = rgbObj.r / 255;
        const g = rgbObj.g / 255;
        const b = rgbObj.b / 255;
        // sRGB → relative luminance (упрощённая)
        const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    // =========================================================================
    //  Стиль кнопок
    // =========================================================================

    function styleButton(btn, variant) {
        const isPrimary = variant === 'primary';
        const baseBg = isPrimary
            ? 'var(--ds-primary, #d0b690)'
            : 'color-mix(in srgb, var(--ds-info-rgb, 255,255,255) 0.45, transparent)';
        const baseColor = isPrimary
            ? 'var(--ds-on-accent, #ffffff)'
            : 'var(--ds-page-text, #09060D)';
        const hoverBg = isPrimary
            ? 'color-mix(in srgb, var(--ds-primary, #d0b690) 86%, black)'
            : 'color-mix(in srgb, var(--ds-info-rgb, 255,255,255) 0.7, transparent)';

        btn.style.cssText = [
            'margin-left: 6px',
            'padding: 2px 10px',
            'font-size: 0.85em',
            'font-weight: 600',
            'line-height: 1.4',
            'cursor: pointer',
            'background: ' + baseBg,
            'color: ' + baseColor,
            'border: 1px solid var(--ui-line, rgba(0,0,0,0.16))',
            'border-radius: 6px',
            'vertical-align: middle',
            'user-select: none',
            'transition: background-color 0.15s ease, transform 0.08s ease, opacity 0.15s ease',
            'white-space: nowrap'
        ].join(';') + ';';

        btn.addEventListener('mouseenter', () => {
            if (btn.disabled) return;
            btn.style.background = hoverBg;
        });
        btn.addEventListener('mouseleave', () => {
            if (btn.disabled) return;
            btn.style.background = baseBg;
            btn.style.transform = '';
        });
        btn.addEventListener('mousedown', () => {
            if (!btn.disabled) btn.style.transform = 'translateY(1px)';
        });
        btn.addEventListener('mouseup', () => {
            btn.style.transform = '';
        });
    }

    // =========================================================================
    //  Рисование: скруглённый прямоугольник
    // =========================================================================

    function pathRoundedRect(ctx, x, y, w, h, r) {
        const radius = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // =========================================================================
    //  Штамп на картинке: «часы UwU» — отдельная скруглённая коробочка сверху
    // =========================================================================

    // Добавляет над canvas белую полосу, по центру которой — скруглённая
    // коробочка (border-radius:10px, padding:5px, тонкая рамка) с подложкой
    // из игры. Внутри в одну строку: «02:05:44 31.10.26» + «🌍 MSK».
    function addTimestampBar(srcCanvas) {
        const cssWidth = srcCanvas._cwCssWidth || (srcCanvas.width / 2);
        const scale = srcCanvas.width / Math.max(1, cssWidth);

        const stripHeightCss = 50;
        const stripHeight = Math.max(40, Math.round(stripHeightCss * scale));

        const out = document.createElement('canvas');
        out.width = srcCanvas.width;
        out.height = stripHeight + srcCanvas.height; // полоса сверху
        const ctx = out.getContext('2d');

        // Подложка из игры (blocksColor) — для коробочки
        const substrate = getGameSubstrateColor();
        const lum = getLuminance(substrate);
        const isLight = lum > 0.5;

        // 1. Полоса сверху — белая (совпадает с backgroundColor html2canvas)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, stripHeight);

        // 2. Исходный скриншот — ниже полосы
        ctx.drawImage(srcCanvas, 0, stripHeight);

        // 3. Коробочка штампа по центру полосы
        const msk = getMoscowDate();
        const timeStr = `${pad(msk.getHours())}:${pad(msk.getMinutes())}:${pad(msk.getSeconds())}`;
        const dateStr = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${String(msk.getFullYear()).slice(-2)}`;
        const iconStr = '🌍 MSK';

        // Шрифт: обычный (не bold), средний размер — как на образце
        const mainFont = Math.max(13, 16 * scale);
        const iconFont = Math.max(11, 14 * scale);

        // Замеры
        const mainText = `${timeStr} ${dateStr}`;
        ctx.font = `${mainFont}px Arial, "Segoe UI", sans-serif`;
        const mainW = ctx.measureText(mainText).width;
        ctx.font = `${iconFont}px Arial, "Segoe UI", sans-serif`;
        const iconW = ctx.measureText(iconStr).width;

        const innerGap = 8 * scale; // между «31.10.26» и «🌍 MSK»
        const contentW = mainW + innerGap + iconW;
        const contentH = Math.max(mainFont, iconFont);

        const boxPad = Math.max(4, 5 * scale);
        const radius = Math.max(6, 10 * scale);

        const boxW = contentW + boxPad * 2;
        const boxH = contentH + boxPad * 2;

        // Центр горизонтально, центр вертикально в полосе
        const boxX = Math.round((out.width - boxW) / 2);
        const boxY = Math.round((stripHeight - boxH) / 2);

        // Заливка коробочки подложкой из игры
        pathRoundedRect(ctx, boxX, boxY, boxW, boxH, radius);
        ctx.fillStyle = substrate.css;
        ctx.fill();

        // Тонкая рамка (как у UwU — 1px solid #ffffff1a, адаптируем под свет подложки)
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = Math.max(1, scale);
        ctx.stroke();

        // Текст
        const textColor = isLight ? '#000000' : '#d5d5d5';
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        // Основной текст: «02:05:44 31.10.26» — слева
        ctx.font = `${mainFont}px Arial, "Segoe UI", sans-serif`;
        const mainY = boxY + boxPad + Math.round((contentH - mainFont) / 2);
        ctx.fillText(mainText, boxX + boxPad, mainY);

        // Иконка «🌍 MSK» — справа, выравнена по вертикали с основным текстом
        ctx.font = `${iconFont}px Arial, "Segoe UI", sans-serif`;
        const iconY = boxY + boxPad + Math.round((contentH - iconFont) / 2);
        ctx.fillText(iconStr, boxX + boxPad + mainW + innerGap, iconY);

        return out;
    }

    // Обрезает полный canvas до видимой части #history_block
    function cropToVisible(srcCanvas, target, scale) {
        const cssW = target.clientWidth;
        const cssH = target.clientHeight;
        const scrollTop = target.scrollTop;

        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(cssW * scale));
        out.height = Math.max(1, Math.round(cssH * scale));
        const ctx = out.getContext('2d');

        const srcY = Math.max(0, Math.round(scrollTop * scale));
        const srcH = Math.round(cssH * scale);
        ctx.drawImage(
            srcCanvas,
            0, srcY, srcCanvas.width, srcH,
            0, 0, out.width, out.height
        );
        return out;
    }

    // =========================================================================
    //  Скачивание
    // =========================================================================

    function downloadCanvas(canvas, modeSlug) {
        const msk = getMoscowDate();
        const stamp =
            `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()}_` +
            `${pad(msk.getHours())}-${pad(msk.getMinutes())}-${pad(msk.getSeconds())}`;
        const filename = `история_${modeSlug}_${stamp}_МСК.png`;

        canvas.toBlob(function (blob) {
            if (!blob) {
                alert('Не удалось собрать PNG (canvas пустой).');
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, 'image/png');
    }

    // =========================================================================
    //  Захват
    // =========================================================================

    function takeScreenshot(btn, mode) {
        const target =
            document.querySelector('#history_block') ||
            document.querySelector('td#history') ||
            document.querySelector('#history');

        if (!target) {
            alert('Блок «История» не найден на странице.');
            return;
        }

        if (typeof window.html2canvas !== 'function') {
            alert('Не удалось загрузить html2canvas. Проверьте интернет и обновите страницу.');
            return;
        }

        const originalLabel = btn.textContent;
        const originalDisabled = btn.disabled;
        btn.disabled = true;
        btn.textContent = '⏳ Делаю скриншот…';

        const scale = Math.min(window.devicePixelRatio || 1.5, 2);

        // Для «full» — временно раскрываем блок, чтобы html2canvas захватил
        // ВЕСЬ контент, а не только видимую часть окошка.
        let savedStyles = null;
        if (mode === 'full') {
            savedStyles = {
                height: target.style.height,
                maxHeight: target.style.maxHeight,
                overflow: target.style.overflow,
                overflowY: target.style.overflowY,
                overflowX: target.style.overflowX,
                resize: target.style.resize
            };
            target.style.height = 'auto';
            target.style.maxHeight = 'none';
            target.style.overflow = 'visible';
            target.style.overflowY = 'visible';
            target.style.overflowX = 'visible';
            target.style.resize = 'none';
            void target.offsetHeight; // force reflow
        }

        const captureWidth = target.scrollWidth || target.offsetWidth;
        const captureHeight = mode === 'full'
            ? target.offsetHeight
            : target.clientHeight;

        const baseOptions = {
            backgroundColor: '#ffffff',
            scale: scale,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: captureWidth,
            height: captureHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: document.documentElement.clientWidth
        };

        function restoreStyles() {
            if (!savedStyles) return;
            target.style.height = savedStyles.height;
            target.style.maxHeight = savedStyles.maxHeight;
            target.style.overflow = savedStyles.overflow;
            target.style.overflowY = savedStyles.overflowY;
            target.style.overflowX = savedStyles.overflowX;
            target.style.resize = savedStyles.resize;
        }

        function finalize(rawCanvas) {
            restoreStyles();

            rawCanvas._cwCssWidth = captureWidth;
            let processed;
            if (mode === 'visible') {
                const cropped = cropToVisible(rawCanvas, target, scale);
                processed = addTimestampBar(cropped);
            } else {
                processed = addTimestampBar(rawCanvas);
            }
            downloadCanvas(processed, mode === 'visible' ? 'видимое' : 'полная');

            btn.textContent = '✅ Сохранено!';
            setTimeout(() => {
                btn.textContent = originalLabel;
                btn.disabled = originalDisabled;
            }, 1500);
        }

        function fail(err) {
            restoreStyles();
            console.error('[CatWar Screenshot] Ошибка:', err);
            alert('Не удалось сделать скриншот:\n' + (err && err.message ? err.message : err));
            btn.textContent = originalLabel;
            btn.disabled = originalDisabled;
        }

        window.html2canvas(target, baseOptions)
            .then(finalize)
            .catch(function (err1) {
                console.warn('[CatWar Screenshot] Первый прогон упал, пробую без allowTaint:', err1);
                const opts2 = Object.assign({}, baseOptions, { allowTaint: false });
                window.html2canvas(target, opts2)
                    .then(finalize)
                    .catch(fail);
            });
    }

    // =========================================================================
    //  Группа кнопок
    // =========================================================================

    function buildGroup() {
        const group = document.createElement('span');
        group.id = GROUP_ID;
        group.style.cssText = 'display: inline-flex; align-items: center; gap: 0; margin-left: 10px; vertical-align: middle;';

        const btnFull = document.createElement('button');
        btnFull.type = 'button';
        btnFull.textContent = '📸 Вся история';
        btnFull.title = 'Сохранить скриншот ВСЕЙ истории (полный захват). Штамп в стиле часов UwU: время, «🌍 MSK», дата — по МСК.';
        styleButton(btnFull, 'primary');
        btnFull.addEventListener('click', () => takeScreenshot(btnFull, 'full'));

        const btnVisible = document.createElement('button');
        btnVisible.type = 'button';
        btnVisible.textContent = '👁 Видимое';
        btnVisible.title = 'Сохранить скриншот только видимой части истории. Штамп в стиле часов UwU: время, «🌍 MSK», дата — по МСК.';
        styleButton(btnVisible, 'secondary');
        btnVisible.addEventListener('click', () => takeScreenshot(btnVisible, 'visible'));

        group.appendChild(btnFull);
        group.appendChild(btnVisible);
        return group;
    }

    function ensureButton() {
        if (document.getElementById(GROUP_ID) || document.getElementById(GROUP_ID_FLAT)) return;

        const historyTd = document.querySelector('td#history');
        if (historyTd) {
            const h2 = historyTd.querySelector('h2');
            if (h2 && !h2.querySelector('#' + GROUP_ID)) {
                h2.appendChild(buildGroup());
                return;
            }
        }

        const historyBlock = document.querySelector('#history_block');
        if (historyBlock && !historyBlock.querySelector('#' + GROUP_ID_FLAT)) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'margin: 0 0 6px 0; text-align: right;';
            const g = buildGroup();
            g.id = GROUP_ID_FLAT;
            wrapper.appendChild(g);
            historyBlock.insertBefore(wrapper, historyBlock.firstChild);
        }
    }

    // =========================================================================
    //  Инициализация
    // =========================================================================

    waitForElement('#history_block', ensureButton);
    waitForElement('td#history', ensureButton);

    const observerTarget = document.getElementById('app') || document.body;
    const observer = new MutationObserver(function () {
        if (!document.getElementById(GROUP_ID) && !document.getElementById(GROUP_ID_FLAT)) {
            ensureButton();
        }
    });
    observer.observe(observerTarget, { childList: true, subtree: true });

    setInterval(function () {
        if (!document.getElementById(GROUP_ID) && !document.getElementById(GROUP_ID_FLAT)) {
            ensureButton();
        }
    }, 2000);
})();
