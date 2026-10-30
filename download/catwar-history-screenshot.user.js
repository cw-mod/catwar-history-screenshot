// ==UserScript==
// @name         CatWar — Скриншот истории
// @namespace    catwar-history-screenshot
// @version      1.1
// @description  Добавляет кнопку «Сделать скриншот» в блок «История» на Игровой CatWar. Скриншот сохраняется в PNG с датой и временем по МСК в имени файла.
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

    const BUTTON_ID = 'cw-history-screenshot-btn';
    const BUTTON_ID_FLAT = 'cw-history-screenshot-btn-flat';

    // ----- Утилиты -------------------------------------------------------------

    // Возвращает строку даты/времени по МСК (UTC+3) в формате DD.MM.YYYY_HH-MM-SS
    function getMoscowStamp() {
        const now = new Date();
        // Москва = UTC+3. Берём UTC-время и прибавляем 3 часа.
        const moscowMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 60 * 60000);
        const msk = new Date(moscowMs);
        const pad = (n) => String(n).padStart(2, '0');
        const date = `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()}`;
        const time = `${pad(msk.getHours())}-${pad(msk.getMinutes())}-${pad(msk.getSeconds())}`;
        return `${date}_${time}`;
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

    // ----- Стиль кнопки --------------------------------------------------------

    function styleButton(btn) {
        btn.style.cssText = [
            'margin-left: 10px',
            'padding: 2px 10px',
            'font-size: 0.85em',
            'font-weight: 600',
            'line-height: 1.4',
            'cursor: pointer',
            'background: var(--ds-primary, #d0b690)',
            'color: var(--ds-on-accent, #ffffff)',
            'border: 1px solid var(--ui-line, rgba(0,0,0,0.16))',
            'border-radius: 6px',
            'vertical-align: middle',
            'user-select: none',
            'transition: background-color 0.15s ease, transform 0.08s ease',
            'white-space: nowrap'
        ].join(';') + ';';

        btn.addEventListener('mouseenter', () => {
            if (btn.disabled) return;
            btn.style.background = 'color-mix(in srgb, var(--ds-primary, #d0b690) 86%, black)';
        });
        btn.addEventListener('mouseleave', () => {
            if (btn.disabled) return;
            btn.style.background = 'var(--ds-primary, #d0b690)';
        });
        btn.addEventListener('mousedown', () => {
            if (!btn.disabled) btn.style.transform = 'translateY(1px)';
        });
        btn.addEventListener('mouseup', () => {
            btn.style.transform = '';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    }

    // ----- Создание скриншота --------------------------------------------------

    function takeScreenshot(btn) {
        // Ищем блок истории. Падаем до td#history, если внутреннего блока нет.
        const target =
            document.querySelector('#history_block') ||
            document.querySelector('td#history') ||
            document.querySelector('#history');

        if (!target) {
            alert('Блок «История» не найден на странице.');
            return;
        }

        if (typeof window.html2canvas !== 'function') {
            alert('Не удалось загрузить html2canvas. Проверьте подключение к интернету и обновите страницу.');
            return;
        }

        const originalLabel = btn.textContent;
        const originalDisabled = btn.disabled;
        btn.disabled = true;
        btn.textContent = '⏳ Делаю скриншот…';

        // Прокрутка блока наверх, чтобы захватить всё содержимое (html2canvas и так
        // захватывает полный scrollHeight, но это страховка).
        const options = {
            backgroundColor: '#ffffff',
            scale: Math.min(window.devicePixelRatio || 1.5, 2),
            useCORS: true,
            allowTaint: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: document.documentElement.clientWidth
        };

        window.html2canvas(target, options).then(function (canvas) {
            const stamp = getMoscowStamp();
            const filename = `история_catwar_${stamp}_МСК.png`;

            canvas.toBlob(function (blob) {
                if (!blob) {
                    throw new Error('canvas.toBlob вернул пустой результат');
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                // Освобождаем URL чуть позже, чтобы скачивание успело стартовать.
                setTimeout(() => URL.revokeObjectURL(url), 1500);

                btn.textContent = '✅ Сохранено!';
                setTimeout(() => {
                    btn.textContent = originalLabel;
                    btn.disabled = originalDisabled;
                }, 1500);
            }, 'image/png');
        }).catch(function (err) {
            console.error('[CatWar Screenshot] Ошибка html2canvas:', err);

            // Запасной вариант: пробуем без allowTaint (иногда чистый canvas
            // получается, если в блоке были cross-origin картинки).
            window.html2canvas(target, {
                backgroundColor: '#ffffff',
                scale: Math.min(window.devicePixelRatio || 1.5, 2),
                useCORS: true,
                allowTaint: false,
                logging: false
            }).then(function (canvas) {
                const stamp = getMoscowStamp();
                const filename = `история_catwar_${stamp}_МСК.png`;
                canvas.toBlob(function (blob) {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1500);

                    btn.textContent = '✅ Сохранено!';
                    setTimeout(() => {
                        btn.textContent = originalLabel;
                        btn.disabled = originalDisabled;
                    }, 1500);
                }, 'image/png');
            }).catch(function (err2) {
                console.error('[CatWar Screenshot] Повторная ошибка:', err2);
                alert('Не удалось сделать скриншот:\n' + (err2 && err2.message ? err2.message : err2));
                btn.textContent = originalLabel;
                btn.disabled = originalDisabled;
            });
        });
    }

    // ----- Вставка кнопки ------------------------------------------------------

    function buildButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = BUTTON_ID;
        btn.textContent = '📸 Сделать скриншот';
        btn.title = 'Сохранить скриншот блока «История» в PNG с датой и временем по МСК';
        styleButton(btn);
        btn.addEventListener('click', function () {
            takeScreenshot(btn);
        });
        return btn;
    }

    function ensureButton() {
        if (document.getElementById(BUTTON_ID)) return;

        // 1) Идеальное место: рядом с заголовком «История» внутри td#history.
        const historyTd = document.querySelector('td#history');
        if (historyTd) {
            const h2 = historyTd.querySelector('h2');
            if (h2 && !h2.querySelector('#' + BUTTON_ID)) {
                h2.appendChild(buildButton());
                return;
            }
        }

        // 2) Запасной вариант: плоская кнопка в самом верху блока #history_block.
        const historyBlock = document.querySelector('#history_block');
        if (historyBlock && !historyBlock.querySelector('#' + BUTTON_ID_FLAT)) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'margin: 0 0 6px 0; text-align: right;';
            const btn = buildButton();
            btn.id = BUTTON_ID_FLAT;
            wrapper.appendChild(btn);
            historyBlock.insertBefore(wrapper, historyBlock.firstChild);
        }
    }

    // ----- Инициализация -------------------------------------------------------

    // Первичная вставка — как только появится нужный элемент.
    waitForElement('#history_block', ensureButton);
    waitForElement('td#history', ensureButton);

    // Страница CatWar динамическая: Vue/JS может перерисовывать блок.
    // Следим за изменениями в #app и при необходимости вставляем кнопку заново.
    const observerTarget = document.getElementById('app') || document.body;
    const observer = new MutationObserver(function () {
        // Не дёргаем ensureButton() слишком часто.
        if (!document.getElementById(BUTTON_ID) && !document.getElementById(BUTTON_ID_FLAT)) {
            ensureButton();
        }
    });
    observer.observe(observerTarget, { childList: true, subtree: true });

    // Подстраховка: раз в 2 секунды проверяем наличие кнопки.
    setInterval(function () {
        if (!document.getElementById(BUTTON_ID) && !document.getElementById(BUTTON_ID_FLAT)) {
            ensureButton();
        }
    }, 2000);
})();
