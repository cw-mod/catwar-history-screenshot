// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      2.0
// @description  Кнопки «📸 Вся история» и «👁 Видимое» в блоке «История» на Игровой CatWar. На скриншот накладывается штамп с датой и временем по МСК. Имя файла тоже содержит МСК-штамп.
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
    //  Утилиты времени (МСК = UTC+3)
    // =========================================================================

    function getMoscowDate() {
        const now = new Date();
        const moscowMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 60 * 60000);
        return new Date(moscowMs);
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    // "31.10.2026 01:20:29" — для штампа на картинке
    function moscowStampPretty() {
        const msk = getMoscowDate();
        return `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()} ` +
               `${pad(msk.getHours())}:${pad(msk.getMinutes())}:${pad(msk.getSeconds())}`;
    }

    // "31.10.2026_01-20-29" — для имени файла (без двоеточий)
    function moscowStampFile() {
        const msk = getMoscowDate();
        return `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()}_` +
               `${pad(msk.getHours())}-${pad(msk.getMinutes())}-${pad(msk.getSeconds())}`;
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
    //  Стиль кнопок
    // =========================================================================

    function styleButton(btn, variant) {
        // variant: 'primary' (вся история) | 'secondary' (видимое)
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
    //  Пост-обработка canvas: штамп + обрезка до видимого
    // =========================================================================

    // Добавляет снизу тёмную полосу с текстом "CatWar • История • DD.MM.YYYY HH:MM:SS МСК"
    function addTimestampBar(srcCanvas, modeLabel) {
        const scale = Math.max(1, srcCanvas.width / Math.max(1, srcCanvas._cwCssWidth || srcCanvas.width / 2));
        const barHeight = Math.max(34, Math.round(34 * scale));
        const padX = Math.round(14 * scale);

        const out = document.createElement('canvas');
        out.width = srcCanvas.width;
        out.height = srcCanvas.height + barHeight;
        const ctx = out.getContext('2d');

        // Фон полосы
        ctx.fillStyle = '#1a1419';
        ctx.fillRect(0, srcCanvas.height, out.width, barHeight);

        // Тонкая разделительная полоска сверху
        ctx.fillStyle = '#b388ff';
        ctx.fillRect(0, srcCanvas.height, out.width, Math.max(1, Math.round(2 * scale)));

        // Исходная картинка
        ctx.drawImage(srcCanvas, 0, 0);

        // Текст
        const fontSize = Math.max(13, Math.round(15 * scale));
        ctx.font = `600 ${fontSize}px Arial, "Segoe UI", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        const stampText = `CatWar • История • ${modeLabel} • ${moscowStampPretty()} МСК`;
        ctx.fillText(stampText, padX, srcCanvas.height + barHeight / 2);

        return out;
    }

    // Обрезает canvas до видимой части #history_block (по scrollTop / clientHeight).
    function cropToVisible(srcCanvas, target, scale) {
        const cssW = target.clientWidth;
        const cssH = target.clientHeight;
        const scrollTop = target.scrollTop;

        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(cssW * scale));
        out.height = Math.max(1, Math.round(cssH * scale));
        const ctx = out.getContext('2d');

        // Тянем из полного canvas только видимую вертикальную полосу
        const srcY = Math.round(scrollTop * scale);
        const srcH = Math.round(cssH * scale);
        ctx.drawImage(
            srcCanvas,
            0, srcY, srcCanvas.width, srcH,   // source
            0, 0, out.width, out.height       // dest
        );
        return out;
    }

    // =========================================================================
    //  Скачивание
    // =========================================================================

    function downloadCanvas(canvas, modeSlug) {
        const stamp = moscowStampFile();
        const filename = `история_catwar_${modeSlug}_${stamp}_МСК.png`;
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

    // mode: 'full' (вся история) | 'visible' (только видимое в окошке)
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

        const baseOptions = {
            backgroundColor: '#ffffff',
            scale: scale,
            useCORS: true,
            allowTaint: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: document.documentElement.clientWidth
        };

        function finalize(rawCanvas) {
            // Запоминаем css-ширину, чтобы корректно посчитать масштаб полосы.
            rawCanvas._cwCssWidth = target.clientWidth;

            let processed;
            if (mode === 'visible') {
                const cropped = cropToVisible(rawCanvas, target, scale);
                processed = addTimestampBar(cropped, 'видимое');
            } else {
                processed = addTimestampBar(rawCanvas, 'вся история');
            }
            downloadCanvas(processed, mode === 'visible' ? 'видимое' : 'вся-история');

            btn.textContent = '✅ Сохранено!';
            setTimeout(() => {
                btn.textContent = originalLabel;
                btn.disabled = originalDisabled;
            }, 1500);
        }

        function fail(err) {
            console.error('[CatWar Screenshot] Ошибка:', err);
            alert('Не удалось сделать скриншот:\n' + (err && err.message ? err.message : err));
            btn.textContent = originalLabel;
            btn.disabled = originalDisabled;
        }

        // Первая попытка с allowTaint: true. Если упадёт — повтор без allowTaint.
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
        btnFull.title = 'Сохранить скриншот ВСЕЙ истории (полный захват с прокруткой). На картинке будет штамп с датой и временем по МСК.';
        styleButton(btnFull, 'primary');
        btnFull.addEventListener('click', () => takeScreenshot(btnFull, 'full'));

        const btnVisible = document.createElement('button');
        btnVisible.type = 'button';
        btnVisible.textContent = '👁 Видимое';
        btnVisible.title = 'Сохранить скриншот только видимой части истории (что сейчас в окошке). На картинке будет штамп с датой и временем по МСК.';
        styleButton(btnVisible, 'secondary');
        btnVisible.addEventListener('click', () => takeScreenshot(btnVisible, 'visible'));

        group.appendChild(btnFull);
        group.appendChild(btnVisible);
        return group;
    }

    function ensureButton() {
        if (document.getElementById(GROUP_ID) || document.getElementById(GROUP_ID_FLAT)) return;

        // 1) Рядом с заголовком «История» внутри td#history.
        const historyTd = document.querySelector('td#history');
        if (historyTd) {
            const h2 = historyTd.querySelector('h2');
            if (h2 && !h2.querySelector('#' + GROUP_ID)) {
                h2.appendChild(buildGroup());
                return;
            }
        }

        // 2) Запасной вариант: плоская группа в самом верху блока #history_block.
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
