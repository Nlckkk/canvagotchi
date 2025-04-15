const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/995h0h77srp019at7cu9hhgpvktme284@import.calendar.google.com/events';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getCalendarEvents') {
    console.log('[Background] Received getCalendarEvents message from:', sender);
    
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Error getting auth token:', chrome.runtime.lastError);
        sendResponse({ error: 'Auth token error' });
        return;
      }
      
      console.log('[Background] Auth token received:', token);
      
      const now = new Date().toISOString();
      const url = `${CALENDAR_API}?timeMin=${now}&singleEvents=true`;
      console.log('[Background] Fetching Calendar API with URL:', url);
      
      fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => {
        console.log('[Background] Calendar API response status:', r.status);
        if (!r.ok) {
          console.error('[Background] Calendar API failed with status:', r.status);
          throw new Error('Calendar API failed');
        }
        return r.json();
      })
      .then(data => {
        console.log('[Background] Raw calendar data received:', data);
        // Filter events: include events matching "assignment", "homework" or "submission"
        // but exclude any that include "office hours".
        const events = data.items.filter(e => {
          console.log('[Background] Checking event:', e.summary);
          const summary = e.summary || "";
          return summary.match(/assignment|homework|submission/i) &&
                 !summary.match(/office hours/i);
        });
        console.log(`[Background] Filtered events count: ${events.length}`);
        sendResponse({ events });
      })
      .catch(error => {
        console.error('[Background] Calendar error:', error);
        sendResponse({ error: 'Calendar unavailable' });
      });
    });
    
    // Return true to indicate asynchronous sendResponse.
    return true;
  }
});
