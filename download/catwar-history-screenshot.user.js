// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      3.0
// @description  Кнопки «📸 Вся история» и «👁 Видимое» в блоке «История» на Игровой CatWar. На скриншот накладывается штамп с временем и датой по МСК в стиле часов UwU (Arial, время крупно + «МСК» + дата снизу), подложка штампа — цвет самого блока из игры.
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
    //  Цвет подложки из игры
    // =========================================================================

    // Берём вычисленный background-color #history_block и композируем его поверх
    // белого (html2canvas использует #ffffff как backgroundColor), чтобы получить
    // непрозрачный rgb-цвет, который можно заливать на canvas.
    function getGameSubstrateColor() {
        const el = document.querySelector('#history_block') ||
                   document.querySelector('td#history') ||
                   document.body;
        try {
            const cs = getComputedStyle(el);
            const bg = cs.backgroundColor; // напр. "rgba(159, 147, 147, 0.55)"
            const m = bg.match(/rgba?\(([^)]+)\)/i);
            if (m) {
                const parts = m[1].split(',').map(s => parseFloat(s.trim()));
                const r = parts[0] | 0, g = parts[1] | 0, b = parts[2] | 0;
                const a = parts.length > 3 ? parts[3] : 1;
                const cr = Math.round(r * a + 255 * (1 - a));
                const cg = Math.round(g * a + 255 * (1 - a));
                const cb = Math.round(b * a + 255 * (1 - a));
                return `rgb(${cr}, ${cg}, ${cb})`;
            }
            return bg || '#b8aaaa';
        } catch (e) {
            return '#b8aaaa';
        }
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
    //  Штамп на картинке: стиль часов UwU
    // =========================================================================

    // Рисует снизу canvas полосу подложкой из игры и кладёт на неё время/МСК/дату
    // шрифтом Arial (время крупно, МСК рядом, дата снизу) — как часы UwU.
    function addTimestampBar(srcCanvas) {
        const cssWidth = srcCanvas._cwCssWidth || (srcCanvas.width / 2);
        const scale = srcCanvas.width / Math.max(1, cssWidth);

        const barHeightCss = 72;
        const barHeight = Math.max(50, Math.round(barHeightCss * scale));
        const sidePadCss = 14;
        const sidePad = Math.round(sidePadCss * scale);

        const out = document.createElement('canvas');
        out.width = srcCanvas.width;
        out.height = srcCanvas.height + barHeight;
        const ctx = out.getContext('2d');

        // 1. Подложка из игры
        const substrate = getGameSubstrateColor();
        ctx.fillStyle = substrate;
        ctx.fillRect(0, srcCanvas.height, out.width, barHeight);

        // 2. Тонкая разделительная полоска сверху (по мотивам border у часов UwU,
        //    но адаптирована под светлую подложку)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.fillRect(0, srcCanvas.height, out.width, Math.max(1, Math.round(1 * scale)));

        // 3. Исходный скриншот
        ctx.drawImage(srcCanvas, 0, 0);

        // 4. Контент: время + МСК + дата, шрифт Arial (как у часов UwU)
        const msk = getMoscowDate();
        const timeStr = `${pad(msk.getHours())}:${pad(msk.getMinutes())}:${pad(msk.getSeconds())}`;
        const dateStr = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()}`;

        // У часов UwU: time=2em (от base 14px => 28px), date=1.2em (~17px), icon/label — base
        const timeFontSize = Math.max(20, Math.round(28 * scale));
        const dateFontSize = Math.max(13, Math.round(17 * scale));
        const labelFontSize = Math.max(11, Math.round(13 * scale));
        const gap = Math.round(6 * scale);

        ctx.font = `bold ${timeFontSize}px Arial, "Segoe UI", sans-serif`;
        const timeW = ctx.measureText(timeStr).width;
        ctx.font = `${labelFontSize}px Arial, "Segoe UI", sans-serif`;
        const labelW = ctx.measureText('МСК').width;
        ctx.font = `${dateFontSize}px Arial, "Segoe UI", sans-serif`;
        const dateW = ctx.measureText(dateStr).width;

        const topRowW = timeW + gap + labelW;
        const contentW = Math.max(topRowW, dateW);
        const contentH = timeFontSize + dateFontSize + gap;

        // Прижимаем вправо
        const contentX = out.width - sidePad - contentW;
        const contentY = srcCanvas.height + Math.round((barHeight - contentH) / 2);

        ctx.fillStyle = '#000000'; // цвет текста как у часов UwU
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        // Время (крупно)
        ctx.font = `bold ${timeFontSize}px Arial, "Segoe UI", sans-serif`;
        ctx.fillText(timeStr, contentX, contentY);

        // МСК (рядом со временем, выравнен по центру строки времени)
        ctx.font = `${labelFontSize}px Arial, "Segoe UI", sans-serif`;
        ctx.fillText('МСК', contentX + timeW + gap, contentY + Math.round((timeFontSize - labelFontSize) / 2));

        // Дата (снизу)
        ctx.font = `${dateFontSize}px Arial, "Segoe UI", sans-serif`;
        ctx.fillText(dateStr, contentX, contentY + timeFontSize + gap);

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
            // force reflow, чтобы html2canvas увидел новые размеры
            void target.offsetHeight;
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
        btnFull.title = 'Сохранить скриншот ВСЕЙ истории (полный захват). На картинке будет штамп с временем и датой по МСК в стиле часов UwU.';
        styleButton(btnFull, 'primary');
        btnFull.addEventListener('click', () => takeScreenshot(btnFull, 'full'));

        const btnVisible = document.createElement('button');
        btnVisible.type = 'button';
        btnVisible.textContent = '👁 Видимое';
        btnVisible.title = 'Сохранить скриншот только видимой части истории. На картинке будет штамп с временем и датой по МСК в стиле часов UwU.';
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
