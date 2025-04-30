// background.js

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "refresh-ui") return;

  // find all tabs on any Canvas domain
  chrome.tabs.query(
    { url: ["*://*.instructure.com/*", "*://canvas.*/*"] },
    (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, msg);
      }
    }
  );
});
