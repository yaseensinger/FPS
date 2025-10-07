let storedDataUrl = null;
let sourceTabId = null;

chrome.action.onClicked.addListener((tab) => {
  console.log('Action clicked, injecting content.js into tab:', tab.id);
  sourceTabId = tab.id;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'capture') {
    console.log('Background: Received capture request');
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Background: Capture error:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log('Background: Capture successful, dataUrl length:', dataUrl ? dataUrl.length : 0);
        sendResponse({ dataUrl });
      }
    });
    return true;
  } else if (message.type === 'download') {
    console.log('Background: Received download request, filename:', message.filename);
    chrome.downloads.download({
      url: message.dataUrl,
      filename: message.filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Background: Download error:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log('Background: Download started, ID:', downloadId);
        sendResponse({ success: true });
      }
    });
    return true;
  } else if (message.type === 'navigate') {
    console.log('Background: Received navigate request, dataUrl length:', message.dataUrl ? message.dataUrl.length : 0);
    storedDataUrl = message.dataUrl; // Store dataUrl
    console.log('Background: Stored dataUrl length:', storedDataUrl ? storedDataUrl.length : 0);
    chrome.tabs.create({
      url: chrome.runtime.getURL('preview.html'),
      active: true
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Background: Navigation error:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log('Background: Opened preview.html in new tab:', tab.id);
        sendResponse({ success: true });
      }
    });
    return true;
  } else if (message.type === 'getDataUrl') {
    console.log('Background: Received getDataUrl request, sending dataUrl length:', storedDataUrl ? storedDataUrl.length : 0);
    sendResponse({ dataUrl: storedDataUrl });
    return true;
  }
});