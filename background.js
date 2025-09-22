chrome.action.onClicked.addListener((tab) => {
  console.log('Action clicked, injecting content.js');
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
        console.log('Background: Capture successful');
        sendResponse({ dataUrl });
      }
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'download') {
    console.log('Background: Received download request');
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
    return true; // Keep channel open for async response
  }
});