// background.js — service worker.
// Forwards toolbar / popup actions to the active tab's content script.

chrome.action.onClicked?.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'tape:toggle' });
  } catch (err) {
    // The content script may not be loaded yet; inject once and retry.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'tape:toggle' });
    } catch (e) {
      console.warn('TAPE: could not toggle on this page', e);
    }
  }
});
