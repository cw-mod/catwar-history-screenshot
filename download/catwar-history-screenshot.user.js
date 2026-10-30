// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      7.2
// @description  Кнопки «📸 Вся история» и «👁 Видимое» в блоке «История» на Игровой CatWar. Скриншотится весь td#history. Перед снимком: кнопки 📲/👁 временно прячутся (на скрине в заголовке остаются только «История» и бейдж часов), в <h2> рядом с заголовком вставляется бейдж «02:05:44 31.10.26 MSK» (rgb(184,170,170), без рамки, не жирный). Все современные CSS color-функции санируются, элементы multi-find-* принудительно делаются inline, чтобы html2canvas не мазал подсветку по строке.
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

    // Цвет бейджа часов (по запросу пользователя)
    const CLOCK_BG = 'rgb(184, 170, 170)';
    const CLOCK_TEXT = '#000000';

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
    //  Стиль кнопок (без color-mix — html2canvas его не парсит)
    // =========================================================================

    function styleButton(btn, variant) {
        const isPrimary = variant === 'primary';
        // Обычные hex/rgba, никаких color-mix() или var() с color-mix внутри
        const baseBg = isPrimary ? '#d0b690' : 'rgba(255, 255, 255, 0.45)';
        const baseColor = isPrimary ? '#ffffff' : '#09060D';
        const hoverBg = isPrimary ? '#b89c70' : 'rgba(255, 255, 255, 0.7)';

        btn.style.cssText = [
            'margin-left: 6px',
            'padding: 2px 10px',
            'font-size: 0.85em',
            'font-weight: 600',
            'line-height: 1.4',
            'cursor: pointer',
            'background: ' + baseBg,
            'color: ' + baseColor,
            'border: 1px solid rgba(0, 0, 0, 0.16)',
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
    //  Бейдж часов (rgb(184, 170, 170), без рамки)
    // =========================================================================

    function createClockStamp() {
        const msk = getMoscowDate();
        const timeStr = `${pad(msk.getHours())}:${pad(msk.getMinutes())}:${pad(msk.getSeconds())}`;
        const dateStr = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${String(msk.getFullYear()).slice(-2)}`;

        const span = document.createElement('span');
        span.id = CLOCK_STAMP_ID;
        span.textContent = `${timeStr} ${dateStr} MSK`;
        span.style.cssText = [
            'margin-left: 10px',
            'padding: 2px 10px',
            'font-family: Arial, "Segoe UI", sans-serif',
            'font-size: 0.9em',
            'font-weight: 400',
            'line-height: 1.4',
            'background: ' + CLOCK_BG,
            'color: ' + CLOCK_TEXT,
            'border-radius: 10px',
            'vertical-align: middle',
            'white-space: nowrap',
            'display: inline-block',
            'user-select: none'
        ].join(';') + ';';
        return span;
    }

    function insertClockStamp(target) {
        const h2 = target.querySelector('h2');
        if (!h2) return null;
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
        document.querySelectorAll('#' + CLOCK_STAMP_ID).forEach(el => el.remove());
    }

    // =========================================================================
    //  Санирование современных CSS color-функций
    // =========================================================================

    // html2canvas не умеет парсить color(), oklch(), oklab(), lab(), lch(), hwb().
    // Пробегаем по всем элементам внутри td#history, и если в computed style
    // какого-то цветового свойства есть такая функция — подменяем inline-стилем
    // на безопасный цвет. После захвата — восстанавливаем.
    const UNSUPPORTED_COLOR_FUNCS = ['color(', 'oklch(', 'oklab(', 'lab(', 'lch(', 'hwb('];

    const COLOR_PROPS_KEBAB = [
        'background-color',
        'color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'border-color',
        'outline-color',
        'text-decoration-color',
        'fill',
        'stroke',
        'box-shadow',
        'caret-color'
    ];

    function sanitizeColorFunctions(rootEl) {
        const saved = [];
        const elements = [rootEl, ...rootEl.querySelectorAll('*')];

        elements.forEach(el => {
            let cs;
            try { cs = getComputedStyle(el); } catch (e) { return; }

            COLOR_PROPS_KEBAB.forEach(prop => {
                let val;
                try { val = cs.getPropertyValue(prop); } catch (e) { return; }
                if (!val) return;
                const lower = val.toLowerCase();
                if (!UNSUPPORTED_COLOR_FUNCS.some(p => lower.includes(p))) return;

                // Запоминаем предыдущее inline-значение, чтобы восстановить
                const prevVal = el.style.getPropertyValue(prop);
                const prevPriority = el.style.getPropertyPriority(prop);
                saved.push({ el, prop, prevVal, prevPriority });

                // Подбираем безопасную замену
                let safe;
                if (prop === 'background-color') {
                    safe = 'rgba(184, 170, 170, 0.55)';
                } else if (prop === 'box-shadow') {
                    safe = 'none';
                } else if (prop === 'fill' || prop === 'stroke') {
                    safe = CLOCK_BG;
                } else {
                    safe = CLOCK_BG;
                }
                el.style.setProperty(prop, safe, 'important');
            });
        });

        // Возвращаем функцию отката
        return function restore() {
            saved.forEach(({ el, prop, prevVal, prevPriority }) => {
                if (prevVal) {
                    el.style.setProperty(prop, prevVal, prevPriority);
                } else {
                    el.style.removeProperty(prop);
                }
            });
        };
    }

    // =========================================================================
    //  Фикс конфликта с расширением Multi-Find
    // =========================================================================

    // Multi-Find оборачивает найденные слова в custom element
    // <multi-find-1-extension>. html2canvas не понимает custom elements и
    // рендерит их как block — подсветка растягивается на всю строку
    // («смазывается»). Инлайн-стиль display:inline не помогает.
    //
    // Решение: перед снимком заменяем каждый <multi-find-1-extension> на
    // обычный <span> с теми же background-color/color (берём из computed
    // style), принудительным display:inline. Классы HL-* не копируем —
    // они могут нести display:block в CSS расширения. После снимка —
    // возвращаем оригинальные custom elements на место.
    function fixMultiFindDisplay(rootEl) {
        const targets = Array.from(rootEl.querySelectorAll('multi-find-1-extension'));
        const replacements = [];

        targets.forEach(original => {
            // Берём вычисленные стили подсветки
            let bg = '';
            let col = '';
            try {
                const cs = getComputedStyle(original);
                bg = cs.backgroundColor || '';
                col = cs.color || '';
            } catch (e) {}

            const span = document.createElement('span');
            // Только нужное: фон, цвет текста, display:inline. Без классов.
            span.style.cssText =
                `background-color: ${bg || 'transparent'}; ` +
                `color: ${col || 'inherit'}; ` +
                `display: inline !important;`;

            // Переносим всё содержимое оригинала в span
            while (original.firstChild) {
                span.appendChild(original.firstChild);
            }

            // Заменяем в DOM
            if (original.parentNode) {
                original.parentNode.replaceChild(span, original);
            }
            replacements.push({ span, original });
        });

        return function restore() {
            replacements.forEach(({ span, original }) => {
                if (span.parentNode) {
                    // Возвращаем содержимое в original
                    while (span.firstChild) {
                        original.appendChild(span.firstChild);
                    }
                    span.parentNode.replaceChild(original, span);
                }
            });
        };
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

        // 1. Прячем группу кнопок 📲/👁 — на скрине в заголовке будут только
        //    «История» и бейдж часов.
        const group = document.getElementById(GROUP_ID) ||
                      document.getElementById(GROUP_ID_FLAT);
        const savedGroupDisplay = group ? group.style.display : null;
        if (group) group.style.display = 'none';

        // 2. Внедряем бейдж часов в <h2>
        const clockStamp = insertClockStamp(target);

        // 3. Для «full» — раскрываем #history_block
        const historyBlock = target.querySelector('#history_block');
        let savedBlockStyles = null;
        if (mode === 'full' && historyBlock) {
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
            void historyBlock.offsetHeight;
        }

        // 4. Санируем color()/oklch()/etc в computed styles внутри td#history
        const restoreColors = sanitizeColorFunctions(target);

        // 4b. Фикс Multi-Find: делаем все <multi-find-1-extension> inline,
        //     чтобы html2canvas не мазал подсветку по всей строке.
        const restoreMultiFind = fixMultiFindDisplay(target);

        // 5. Замеряем размеры
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
            // 1. Восстанавливаем color-функции
            try { restoreColors(); } catch (e) {}
            // 1b. Восстанавливаем display у multi-find элементов
            try { restoreMultiFind(); } catch (e) {}
            // 2. Восстанавливаем #history_block
            if (savedBlockStyles && historyBlock) {
                historyBlock.style.height = savedBlockStyles.height;
                historyBlock.style.maxHeight = savedBlockStyles.maxHeight;
                historyBlock.style.overflow = savedBlockStyles.overflow;
                historyBlock.style.overflowY = savedBlockStyles.overflowY;
                historyBlock.style.overflowX = savedBlockStyles.overflowX;
                historyBlock.style.resize = savedBlockStyles.resize;
            }
            // 3. Удаляем бейдж часов
            removeClockStamp(clockStamp);
            // 4. Восстанавливаем видимость группы кнопок
            if (group) group.style.display = savedGroupDisplay;
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
        btnFull.title = 'Сохранить скриншот ВСЕЙ истории (с заголовком). Кнопки 📲/👁 на скрине спрячутся, рядом с заголовком «История» будет бейдж «время дата MSK» по МСК.';
        styleButton(btnFull, 'primary');
        btnFull.addEventListener('click', () => takeScreenshot(btnFull, 'full'));

        const btnVisible = document.createElement('button');
        btnVisible.type = 'button';
        btnVisible.textContent = '👁 Видимое';
        btnVisible.title = 'Сохранить скриншот только видимой части истории (с заголовком). Кнопки 📲/👁 на скрине спрячутся, рядом с заголовком «История» будет бейдж «время дата MSK» по МСК.';
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
