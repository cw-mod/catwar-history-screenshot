// ==UserScript==
// @name         CatWar — Автопрокрутка истории вниз
// @namespace    catwar-history-autoscroll
// @version      1.0.0
// @description  Автоматически прокручивает блок «История» в самый низ после обновления страницы.
// @author       кошечка
// @match        https://catwar.su/cw3/*
// @match        https://catwar.su/cw3
// @match        http://catwar.su/cw3/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const DELAY_MS = 1500;

    function scrollHistoryToBottom() {
        const block = document.getElementById('history_block');
        if (!block) return false;
        block.scrollTop = block.scrollHeight;
        return true;
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

    waitForElement('#history_block', function () {
        setTimeout(scrollHistoryToBottom, DELAY_MS);

        const observer = new MutationObserver(function () {
            scrollHistoryToBottom();
        });
        observer.observe(document.getElementById('history_block'), {
            childList: true,
            subtree: true,
            characterData: true
        });
    });
})();
