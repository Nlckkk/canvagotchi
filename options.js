document.addEventListener('DOMContentLoaded', function () {
    const calendarIdInput = document.getElementById('calendarId');
    const saveButton = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
  
    // Retrieve the stored calendarId; if not set, default to an empty string (which your background can handle as "primary")
    chrome.storage.sync.get('calendarId', function(result) {
      if (result.calendarId) {
        calendarIdInput.value = result.calendarId;
      }
    });
  
    // Save the value to storage when the user clicks "Save"
    saveButton.addEventListener('click', function() {
      const newCalendarId = calendarIdInput.value.trim();
      // If user leaves it blank, you can use "primary" or your desired default.
      chrome.storage.sync.set({ calendarId: newCalendarId || 'primary' }, function() {
        statusDiv.textContent = 'Options saved.';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
      });
    });
  });
  