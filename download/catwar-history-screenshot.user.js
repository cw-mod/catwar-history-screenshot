// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      6.0
// @description  Кнопки «📸 Вся история» и «👁 Видимое» в блоке «История» на Игровой CatWar. Скриншотится весь td#history (с заголовком «История», кнопками и блоком). Перед снимком в заголовок рядом с кнопками временно вставляется «бейдж» с часами UwU-стиля: «🌍 02:05:44 31.10.26 MSK» по МСК.
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
    const CLOCK_STAMP_ID = 'cw-history-clock-stamp';

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
    //  Бейдж часов (вставляется в <h2> рядом с кнопками на время снимка)
    // =========================================================================

    // Стилизован как маленький «бейдж» в духе часов UwU: скруглённый,
    // подложка info-блока игры, тёмный текст, тонкая рамка.
    function createClockStamp() {
        const msk = getMoscowDate();
        const timeStr = `${pad(msk.getHours())}:${pad(msk.getMinutes())}:${pad(msk.getSeconds())}`;
        const dateStr = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${String(msk.getFullYear()).slice(-2)}`;

        const span = document.createElement('span');
        span.id = CLOCK_STAMP_ID;
        span.textContent = `🌍 ${timeStr} ${dateStr} MSK`;
        span.style.cssText = [
            'margin-left: 10px',
            'padding: 2px 10px',
            'font-family: Arial, "Segoe UI", sans-serif',
            'font-size: 0.9em',
            'font-weight: 600',
            'line-height: 1.4',
            'background: color-mix(in srgb, var(--ds-info-rgb, 255,255,255) 0.6, transparent)',
            'color: var(--ds-page-text, #09060D)',
            'border: 1px solid var(--ui-line, rgba(0,0,0,0.18))',
            'border-radius: 10px',
            'vertical-align: middle',
            'white-space: nowrap',
            'display: inline-block',
            'user-select: none'
        ].join(';') + ';';
        return span;
    }

    function insertClockStamp(target) {
        // Находим заголовок <h2> внутри td#history — туда уже вставлены кнопки
        // скриншота. Кладём бейдж часов рядом (в конец <h2>).
        const h2 = target.querySelector('h2');
        if (!h2) return null;
        // На всякий случай — удаляем предыдущий, если вдруг остался
        const prev = h2.querySelector('#' + CLOCK_STAMP_ID);
        if (prev) prev.remove();
        const stamp = createClockStamp();
        h2.appendChild(stamp);
        return stamp;
    }

    function removeClockStamp(stamp) {
        if (stamp && stamp.parentNode) {
            stamp.parentNode.removeChild(stamp);
        }
        // Подстраховка — убираем все такие элементы на странице
        document.querySelectorAll('#' + CLOCK_STAMP_ID).forEach(el => el.remove());
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
        // Захватываем ВЕСЬ td#history — включая <h2> (заголовок «История»,
        // кнопки 📲/👁 и наш бейдж часов) и сам #history_block с текстом.
        const target =
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

        // 1. Внедряем бейдж часов в заголовок рядом с кнопками
        const clockStamp = insertClockStamp(target);

        // 2. Для «full» — раскрываем #history_block, чтобы захватить весь
        // контент, а не только видимую часть окошка.
        const historyBlock = target.querySelector('#history_block');
        let savedStyles = null;
        if (mode === 'full' && historyBlock) {
            savedStyles = {
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

        // 3. Размеры для html2canvas
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

        function cleanup() {
            removeClockStamp(clockStamp);
            if (savedStyles && historyBlock) {
                historyBlock.style.height = savedStyles.height;
                historyBlock.style.maxHeight = savedStyles.maxHeight;
                historyBlock.style.overflow = savedStyles.overflow;
                historyBlock.style.overflowY = savedStyles.overflowY;
                historyBlock.style.overflowX = savedStyles.overflowX;
                historyBlock.style.resize = savedStyles.resize;
            }
        }

        function finalize(rawCanvas) {
            cleanup();
            downloadCanvas(rawCanvas, mode === 'visible' ? 'видимое' : 'полная');

            btn.textContent = '✅ Сохранено!';
            setTimeout(() => {
                btn.textContent = originalLabel;
                btn.disabled = originalDisabled;
            }, 1500);
        }

        function fail(err) {
            cleanup();
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
        btnFull.title = 'Сохранить скриншот ВСЕЙ истории (с заголовком и кнопками). Рядом с кнопками на скрине будет бейдж с временем и датой по МСК.';
        styleButton(btnFull, 'primary');
        btnFull.addEventListener('click', () => takeScreenshot(btnFull, 'full'));

        const btnVisible = document.createElement('button');
        btnVisible.type = 'button';
        btnVisible.textContent = '👁 Видимое';
        btnVisible.title = 'Сохранить скриншот только видимой части истории (с заголовком и кнопками). Рядом с кнопками на скрине будет бейдж с временем и датой по МСК.';
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

        // Запасной вариант: если нет td#history, кнопки в самый верх блока #history_block
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
