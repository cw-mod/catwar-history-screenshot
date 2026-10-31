// ==UserScript==
// @name         CatWar — Автопрокрутка истории вниз
// @namespace    catwar-history-autoscroll
// @version      1.1.0
// @description  Автоматически прокручивает блок «История» в самый низ после обновления страницы (не мешает ручной прокрутке вверх).
// @author       кошечка
// @match        https://catwar.su/cw3/*
// @match        https://catwar.su/cw3
// @match        http://catwar.su/cw3/*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/cw-mod/catwar-history-screenshot/main/catwar-history-autoscroll.user.js
// @downloadURL  https://raw.githubusercontent.com/cw-mod/catwar-history-screenshot/main/catwar-history-autoscroll.user.js
// ==/UserScript==
(function () {
'use strict';

const DELAY_MS = 1500;
const NEAR_BOTTOM_THRESHOLD = 60; // px — считаем, что пользователь у дна
const DEBOUNCE_MS = 80;

let isNearBottom = true; // стартовая прокрутка вниз — всегда
let debounceTimer = null;

function scrollHistoryToBottom(block) {
  if (!block) return;
  block.scrollTop = block.scrollHeight;
}

function isUserNearBottom(block) {
  return block.scrollHeight - block.scrollTop - block.clientHeight < NEAR_BOTTOM_THRESHOLD;
}

function onMutation(block) {
  // Не дёргаем пользователя, если он сам пролистал наверх.
  if (!isUserNearBottom(block)) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    scrollHistoryToBottom(block);
  }, DEBOUNCE_MS);
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

waitForElement('#history_block', function (block) {
  // Стартовая прокрутка вниз через задержку — даём странице догрузиться.
  setTimeout(() => scrollHistoryToBottom(block), DELAY_MS);

  // Слежение за ручной прокруткой пользователя.
  let userScrollTimer = null;
  block.addEventListener('scroll', () => {
    // Отмечаем, что пользователь мог прокрутиться вверх вручную.
    if (userScrollTimer) clearTimeout(userScrollTimer);
    userScrollTimer = setTimeout(() => {
      userScrollTimer = null;
      isNearBottom = isUserNearBottom(block);
    }, 60);
  }, { passive: true });

  const observer = new MutationObserver(() => onMutation(block));
  observer.observe(block, { childList: true, subtree: true, characterData: true });
});

})();
