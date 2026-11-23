/* 02 입찰 도구 — 서비스 워커: 프레임 간 결과 중계 · 전체 도구 열기 · 아이콘 클릭 처리 */
'use strict';
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'wic02_found' && sender.tab) {
    chrome.tabs.sendMessage(sender.tab.id, {type: 'wic02_show', data: msg.data}, {frameId: 0}).catch(() => {});
  } else if (msg.type === 'wic02_open') {
    chrome.storage.local.set({wic02_pending: msg.payload}).then(() => chrome.tabs.create({url: chrome.runtime.getURL('app.html')}));
  }
});
chrome.action.onClicked.addListener(async tab => {
  if (!tab || !tab.id) { chrome.tabs.create({url: chrome.runtime.getURL('app.html')}); return; }
  try { await chrome.tabs.sendMessage(tab.id, {type: 'wic02_scan'}); }
  catch (e) {
    try { await chrome.scripting.executeScript({target: {tabId: tab.id, allFrames: true}, files: ['engine.js', 'content.js']}); await chrome.tabs.sendMessage(tab.id, {type: 'wic02_scan'}).catch(() => {}); }
    catch (e2) { chrome.tabs.create({url: chrome.runtime.getURL('app.html')}); }
  }
});
