// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      8.4
// @description  Кнопки «📸 Вся история» и «👁 Видимое» в блоке «История» на Игровой CatWar. Скриншотится весь td#history. Перед снимком: кнопки 📲/👁 временно прячутся, в <h2> вставляется бейдж «🌍︎ 02:05:44 31.10.26 MSK» (rgb(184,170,170), без рамки, не жирный, иконка монохромная через U+FE0E). Фон td#history подменяется на rgb(107,86,88) — как в игре, а не светлый из-за композита поверх белого. #history_block ВСЕГДА раскрывается, для visible canvas обрезается с учётом scrollTop. В onclone: multi-find-элементы разбиваются на слова в <span inline-block>, color()/oklch()/etc санируются.
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

    // Цвет подложки td#history (как он выглядит в игре — непрозрачный).
    // В CSS игры фон задан как rgba(...,0.7), html2canvas рендерит его поверх
    // белого и получает светлый rgb(172,158,162). Подменяем на непрозрачный
    // rgb(107,86,88), чтобы было как в игре.
    const TARGET_BG_COLOR = 'rgb(107, 86, 88)';

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
        span.style.cssText = [
            'margin-left: 10px',
            'padding: 4px 10px',
            'font-family: Arial, "Segoe UI", sans-serif',
            'font-size: 0.9em',
            'font-weight: 400',
            'line-height: 1.3',
            'background: ' + CLOCK_BG,
            'color: ' + CLOCK_TEXT,
            'border-radius: 10px',
            'vertical-align: middle',
            'display: inline-block',
            'user-select: none'
        ].join(';') + ';';

        // Используем таблицу — html2canvas надёжно рендерит таблицы,
        // в отличие от flex/grid/block-внутри-inline-block.
        //
        // Layout:
        //   | 03:45:58 31.10.26 (rowspan=2) | 🌍 |
        //   |                               | MSK |
        const table = document.createElement('table');
        table.style.cssText =
            'display: inline-table; border-collapse: collapse; vertical-align: middle;';

        // Первая строка: время+дата (с rowspan=2) и иконка 🌍
        const tr1 = document.createElement('tr');

        const tdTimeDate = document.createElement('td');
        tdTimeDate.rowSpan = 2;
        tdTimeDate.style.cssText =
            'vertical-align: middle; padding-right: 8px; white-space: nowrap;';
        tdTimeDate.textContent = `${timeStr} ${dateStr}`;

        const tdIcon = document.createElement('td');
        tdIcon.style.cssText = 'text-align: center; vertical-align: middle;';
        // 🌍 + U+FE0E (variation selector) — монохромная иконка глобуса, как в UwU
        tdIcon.textContent = '\u{1F30D}\u{FE0E}';

        tr1.appendChild(tdTimeDate);
        tr1.appendChild(tdIcon);

        // Вторая строка: MSK (под иконкой)
        const tr2 = document.createElement('tr');

        const tdMsk = document.createElement('td');
        tdMsk.style.cssText =
            'text-align: center; vertical-align: middle; font-size: 0.7em;';
        tdMsk.textContent = 'MSK';

        tr2.appendChild(tdMsk);

        table.appendChild(tr1);
        table.appendChild(tr2);
        span.appendChild(table);
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

    // =========================================================================
    //  Санирование клонированного документа (через onclone html2canvas)
    // =========================================================================

    // В клонированном документе Multi-Find не активен (его JS не работает
    // в клоне), поэтому безопасно можно:
    //   1. Заменить <multi-find-1-extension> на набор <span> по одному на
    //      каждое слово (display: inline-block) + <span> с пробелами между
    //      ними (display: inline-block, transparent). Иначе html2canvas
    //      рендерит подряд идущие inline-span с одинаковым фоном как один
    //      сплошной блок — подсветка «слипается».
    //   2. Санировать color()/oklch()/oklab()/lab()/lch()/hwb() в computed
    //      стилях — html2canvas их не умеет парсить и падает.
    function sanitizeClone(clonedDoc, rootEl) {
        const win = clonedDoc.defaultView;
        let replacedCount = 0;

        // --- 1. Замена multi-find-extension на набор слов в inline-block ---
        const mfeTargets = Array.from(rootEl.querySelectorAll('multi-find-1-extension'));
        mfeTargets.forEach(original => {
            let inlineBg = original.style.backgroundColor;
            let inlineColor = original.style.color;

            // Если инлайн-стиля нет — берём из computed
            if ((!inlineBg || !inlineColor) && win) {
                try {
                    const cs = win.getComputedStyle(original);
                    if (!inlineBg) inlineBg = cs.backgroundColor;
                    if (!inlineColor) inlineColor = cs.color;
                } catch (e) {}
            }

            // inline-block: имеет явную ширину по содержимому, не растягивается
            // на всю строку и не сливается с соседями.
            const wordCss =
                `background-color: ${inlineBg || 'transparent'}; ` +
                `color: ${inlineColor || 'inherit'}; ` +
                `display: inline-block; ` +
                `padding: 0; ` +
                `margin: 0; ` +
                `line-height: inherit;`;

            // Пробелы — отдельный span с transparent фоном и inline-block,
            // чтобы html2canvas точно видел разделитель между подсвеченными
            // словами (text node может рендериться с нулевой шириной).
            const spaceCss =
                `display: inline-block; ` +
                `background: transparent;`;

            const fragment = clonedDoc.createDocumentFragment();
            const text = original.textContent || '';
            const parts = text.split(/(\s+)/);
            parts.forEach(part => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    const spaceSpan = clonedDoc.createElement('span');
                    spaceSpan.style.cssText = spaceCss;
                    spaceSpan.textContent = part;
                    fragment.appendChild(spaceSpan);
                } else {
                    const span = clonedDoc.createElement('span');
                    span.style.cssText = wordCss;
                    span.textContent = part;
                    fragment.appendChild(span);
                }
            });

            if (original.parentNode) {
                original.parentNode.replaceChild(fragment, original);
                replacedCount++;
            }
        });

        console.info('[CatWar Screenshot] sanitizeClone: заменено ' + replacedCount + ' multi-find элементов');

        // --- 1b. Подменяем фон td#history на непрозрачный rgb(107,86,88) ---
        // В CSS игры фон задан как rgba(...,0.7), html2canvas рендерит поверх
        // белого и получает светлый rgb(172,158,162). Подменяем на непрозрачный
        // тёмный, как в игре.
        rootEl.style.setProperty('background-color', TARGET_BG_COLOR, 'important');

        // --- 2. Санирование color-функций ---
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
                if (prop === 'background-color') {
                    safe = 'rgba(184, 170, 170, 0.55)';
                } else if (prop === 'box-shadow') {
                    safe = 'none';
                } else {
                    safe = CLOCK_BG;
                }
                el.style.setProperty(prop, safe, 'important');
            });
        });
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

        // 3. Замеряем видимые размеры ДО раскрытия (для visible режима)
        const historyBlock = target.querySelector('#history_block');
        const h2El = target.querySelector('h2');

        const targetRect = target.getBoundingClientRect();
        const h2Rect = h2El ? h2El.getBoundingClientRect() : null;
        const histRect = historyBlock ? historyBlock.getBoundingClientRect() : null;

        const visibleClientHeight = targetRect.height;
        const h2OffsetInTarget = h2Rect ? (h2Rect.top - targetRect.top) : 0;
        const h2Height = h2Rect ? h2Rect.height : 0;
        const scrollTop = historyBlock ? historyBlock.scrollTop : 0;

        // 4. ВСЕГДА раскрываем #history_block — и для full, и для visible.
        //    Иначе html2canvas рендерит #history_block со скроллом, и
        //    multi-find-extension, которые частично срезаны скроллом,
        //    рендерятся с растянутой подсветкой (мазня).
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
            void historyBlock.offsetHeight;
        }

        // 5. Замеряем размеры ПОСЛЕ раскрытия
        const captureWidth = target.scrollWidth || target.offsetWidth;
        const captureHeight = target.offsetHeight;

        // Санирование (замена multi-find на span + color-функции) делаем в
        // onclone — то есть в уже клонированном документе, где Multi-Find
        // не активен и не сможет вернуть свои custom elements обратно.
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
            windowWidth: document.documentElement.clientWidth,
            onclone: function (clonedDoc, element) {
                const clonedTarget = element || clonedDoc.querySelector('td#history');
                if (!clonedTarget) return;
                try { sanitizeClone(clonedDoc, clonedTarget); } catch (e) {
                    console.warn('[CatWar Screenshot] sanitizeClone упал:', e);
                }
            }
        };

        function cleanup() {
            // 1. Восстанавливаем #history_block
            if (savedBlockStyles && historyBlock) {
                historyBlock.style.height = savedBlockStyles.height;
                historyBlock.style.maxHeight = savedBlockStyles.maxHeight;
                historyBlock.style.overflow = savedBlockStyles.overflow;
                historyBlock.style.overflowY = savedBlockStyles.overflowY;
                historyBlock.style.overflowX = savedBlockStyles.overflowX;
                historyBlock.style.resize = savedBlockStyles.resize;
            }
            // 2. Удаляем бейдж часов
            removeClockStamp(clockStamp);
            // 3. Восстанавливаем видимость группы кнопок
            if (group) group.style.display = savedGroupDisplay;
        }

        function finalize(rawCanvas) {
            cleanup();

            // Для visible режима — обрезаем canvas до видимой области.
            // После раскрытия canvas содержит полный td#history: padding.top +
            // h2 + полная #history_block (без скролла).
            // Хотим показать: padding.top + h2 + видимую часть #history_block
            // (с учётом scrollTop).
            let finalCanvas = rawCanvas;
            if (mode === 'visible') {
                try {
                    const s = scale;
                    // Верхняя часть (padding + h2) — копируем как есть
                    const upperEnd = Math.round((h2OffsetInTarget + h2Height) * s);
                    // Начало видимой части истории в полном canvas:
                    // h2OffsetInTarget + h2Height + scrollTop
                    const histSrcY = Math.round((h2OffsetInTarget + h2Height + scrollTop) * s);
                    // Высота видимой части истории:
                    // visibleClientHeight - h2OffsetInTarget - h2Height
                    const histSrcH = Math.max(0, Math.round((visibleClientHeight - h2OffsetInTarget - h2Height) * s));

                    const newCanvas = document.createElement('canvas');
                    newCanvas.width = rawCanvas.width;
                    newCanvas.height = Math.round(visibleClientHeight * s);
                    const ctx = newCanvas.getContext('2d');

                    // Заливаем белым фоном (на всякий случай)
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

                    // Копируем padding + h2
                    if (upperEnd > 0) {
                        ctx.drawImage(rawCanvas,
                            0, 0, rawCanvas.width, upperEnd,
                            0, 0, rawCanvas.width, upperEnd);
                    }

                    // Копируем видимую часть истории (со смещением скролла)
                    if (histSrcH > 0) {
                        ctx.drawImage(rawCanvas,
                            0, histSrcY, rawCanvas.width, histSrcH,
                            0, upperEnd, rawCanvas.width, histSrcH);
                    }

                    finalCanvas = newCanvas;
                } catch (e) {
                    console.warn('[CatWar Screenshot] Обрезка visible упала:', e);
                }
            }

            downloadCanvas(finalCanvas, mode === 'visible' ? 'видимое' : 'полная');

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
