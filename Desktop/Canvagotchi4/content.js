// Allow page scrolling by overriding body overflow.
document.body.style.setProperty("overflow", "auto", "important");

// ---------------------------------------------------------------------------
// Domain Checks
function isCanvasDomain() {
  const host = window.location.host.toLowerCase();
  return host.includes("canvas") || host === "uncc.instructure.com";
}

function isAuthorizedDomainForCalendar() {
  const host = window.location.host.toLowerCase();
  return host.includes("canvas") || host === "uncc.instructure.com" || host === "calendar.google.com";
}

console.log("Canvas extension script loaded. Domain:", window.location.host);

// ---------------------------------------------------------------------------
// Canvas + Progress Variables
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
let happiness = 50;
let streak = 0;
let lastFedDate = null;
let currentProgress = 0; // 0–100
let rewardPopupActive = false;

// New Level Variables
let currentLevel = 1;
const maxLevel = 20;

// Retrieve saved progress and level on load
chrome.storage.local.get(["currentProgress", "currentLevel"], (data) => {
  if (data.currentProgress !== undefined) {
    currentProgress = data.currentProgress;
  }
  if (data.currentLevel !== undefined) {
    currentLevel = data.currentLevel;
  }
  updateProgressBar();
});

// ---------------------------------------------------------------------------
// UI Customization Defaults
const defaultUISettings = {
  uiAssignmentTextColor: "#92d4a7",
  uiAssignmentBorderColor: "#92d4a7",
  uiAssignmentBackgroundColor: "#1a1a1a",
  uiProgressBarColor: "#6b8cff"
};

let uiSettings = { ...defaultUISettings };
chrome.storage.sync.get(Object.keys(defaultUISettings), (stored) => {
  uiSettings = { ...defaultUISettings, ...stored };
  updateUICustomization();
});

// ---------------------------------------------------------------------------
// Gotchi Animation Variables (using icon48.png as sprite sheet)
// Assumed layout:
// - SPRITE_BLOCK_COLS: number of gotchi blocks per row (4)
// - SPRITE_BLOCK_ROWS: total rows of blocks (2)
// - Each block is subdivided into FRAME_COLS x FRAME_ROWS frames (3x4 = 12 frames)
let gotchiSprite = new Image();
gotchiSprite.src = chrome.runtime.getURL('icons/icon48.png');
let gotchiSpriteLoaded = false;
let currentAnimationFrame = 0;  // frame index: 0 .. 11
const SPRITE_BLOCK_COLS = 4;
const SPRITE_BLOCK_ROWS = 2;
const FRAME_COLS = 3;
const FRAME_ROWS = 4;
let blockWidth, blockHeight, frameWidth, frameHeight;

// Selected gotchi block (user can change via customization)
let selectedBlockRow = 0;
let selectedBlockCol = 1; // Default: middle block of top row

// Retrieve saved sprite selection (if any)
chrome.storage.local.get(["selectedBlockRow", "selectedBlockCol"], (data) => {
  if (data.selectedBlockRow !== undefined) {
    selectedBlockRow = data.selectedBlockRow;
  }
  if (data.selectedBlockCol !== undefined) {
    selectedBlockCol = data.selectedBlockCol;
  }
});

gotchiSprite.onload = () => {
  gotchiSpriteLoaded = true;
  // Calculate dimensions from the sprite sheet.
  blockWidth = gotchiSprite.width / SPRITE_BLOCK_COLS;
  blockHeight = gotchiSprite.height / SPRITE_BLOCK_ROWS;
  frameWidth = blockWidth / FRAME_COLS;
  frameHeight = blockHeight / FRAME_ROWS;
  console.log("Gotchi sprite loaded:", gotchiSprite.width, gotchiSprite.height);
  console.log("Block dimensions:", blockWidth, blockHeight);
  console.log("Frame dimensions:", frameWidth, frameHeight);
  // Start animation loop at approximately 5 frames per second.
  setInterval(animateGotchi, 200);
};

function animateGotchi() {
  if (!gotchiSpriteLoaded) return;
  currentAnimationFrame = (currentAnimationFrame + 1) % (FRAME_COLS * FRAME_ROWS);
  drawGotchiFrame();
}

function drawGotchiFrame() {
  if (!gotchiSpriteLoaded) return;
  let frameRow = Math.floor(currentAnimationFrame / FRAME_COLS);
  let frameCol = currentAnimationFrame % FRAME_COLS;
  
  let sourceX = selectedBlockCol * blockWidth + frameCol * frameWidth;
  let sourceY = selectedBlockRow * blockHeight + frameRow * frameHeight;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    gotchiSprite,
    sourceX, sourceY,
    frameWidth, frameHeight,
    0, 0,
    canvas.width, canvas.height
  );
}

// ---------------------------------------------------------------------------
// Pet Container Setup (top-left)
// Create a container that holds the gotchi animation (canvas), progress bar, and control buttons.
const petContainer = document.createElement('div');
petContainer.id = 'pet-container';
petContainer.style.position = 'fixed';
petContainer.style.top = '20px';
petContainer.style.left = '20px';
petContainer.style.width = '320px';
petContainer.style.background = '#1e1e1e';
petContainer.style.border = '2px solid #aaa';
petContainer.style.borderRadius = '8px';
petContainer.style.padding = '10px';
petContainer.style.zIndex = '9999';
petContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
petContainer.style.cursor = 'grab';

// Setup the canvas for sprite animation
canvas.width = 300;
canvas.height = 300;
canvas.style.position = 'relative';
canvas.style.left = '0';
canvas.style.top = '0';
canvas.style.display = 'block';
canvas.style.margin = 'auto';
petContainer.appendChild(canvas);

// Add a progress bar inside the pet container (below the canvas)
const petProgressBarContainer = document.createElement('div');
petProgressBarContainer.style.marginTop = '10px';
petProgressBarContainer.style.background = '#333';
petProgressBarContainer.style.height = '12px';
petProgressBarContainer.style.borderRadius = '5px';
petProgressBarContainer.style.overflow = 'hidden';

const petProgressBar = document.createElement('div');
petProgressBar.id = 'pet-progress-bar';
petProgressBar.style.height = '100%';
petProgressBar.style.width = '0%';
petProgressBar.style.background = uiSettings.uiProgressBarColor;
petProgressBar.style.transition = 'width 0.3s ease';
petProgressBarContainer.appendChild(petProgressBar);

const petProgressText = document.createElement('div');
petProgressText.id = 'pet-progress-text';
petProgressText.style.textAlign = 'center';
petProgressText.style.color = '#fff';
petProgressText.style.marginTop = '5px';

petContainer.appendChild(petProgressBarContainer);
petContainer.appendChild(petProgressText);

// Add a "Customize Sprite" button to allow sprite selection.
const customizeSpriteButton = document.createElement('button');
customizeSpriteButton.textContent = 'Customize Sprite';
customizeSpriteButton.style.marginTop = '10px';
customizeSpriteButton.style.width = '100%';
customizeSpriteButton.style.background = '#444';
customizeSpriteButton.style.color = '#fff';
customizeSpriteButton.style.border = 'none';
customizeSpriteButton.style.padding = '6px';
customizeSpriteButton.style.borderRadius = '4px';
customizeSpriteButton.style.cursor = 'pointer';
customizeSpriteButton.addEventListener('click', () => {
  showSpriteCustomizationPopup();
});
petContainer.appendChild(customizeSpriteButton);

// Append pet container to the body and make it draggable.
document.body.appendChild(petContainer);
makeDraggable(petContainer, 'petContainerPosition');

// ---------------------------------------------------------------------------
// Health & Hunger Setup
let health = 100;
let hunger = 100;
// Ensure feed button works by providing a stub for sound effects if sfx is missing.
const sfx = window.sfx || {
  select: { play: () => Promise.resolve() },
  happy: { play: () => Promise.resolve() },
  sad: { play: () => Promise.resolve() },
  sparkle: { play: () => Promise.resolve() }
};

chrome.storage.local.get(["health", "hunger"], (data) => {
  if (data.health !== undefined) { health = data.health; }
  if (data.hunger !== undefined) { hunger = data.hunger; }
  updatePetStatsUI();
});

function createStatBar(labelText, id, color) {
  const wrapper = document.createElement('div');
  wrapper.style.margin = '6px 0';
  const label = document.createElement('div');
  label.innerText = labelText;
  label.style.color = '#fff';
  label.style.fontSize = '12px';
  wrapper.appendChild(label);
  const bar = document.createElement('div');
  bar.id = id;
  bar.style.height = '12px';
  bar.style.background = '#333';
  bar.style.border = '1px solid #888';
  bar.style.borderRadius = '5px';
  bar.style.overflow = 'hidden';
  const fill = document.createElement('div');
  fill.style.height = '100%';
  fill.style.width = '100%';
  fill.style.background = color;
  fill.style.transition = 'width 0.3s ease';
  fill.className = `${id}-fill`;
  bar.appendChild(fill);
  wrapper.appendChild(bar);
  return wrapper;
}

petContainer.appendChild(createStatBar("Health", "health-bar", "#78d67d"));
petContainer.appendChild(createStatBar("Hunger", "hunger-bar", "#e2ad3b"));

// Feed Button: increases hunger by 25 (capped at 100), plays a sound, and updates UI.
const feedBtn = document.createElement('button');
feedBtn.textContent = 'Feed';
feedBtn.style.marginTop = '8px';
feedBtn.style.width = '100%';
feedBtn.style.background = '#444';
feedBtn.style.color = '#fff';
feedBtn.style.border = 'none';
feedBtn.style.padding = '6px';
feedBtn.style.borderRadius = '4px';
feedBtn.style.cursor = 'pointer';
feedBtn.addEventListener('click', () => {
  hunger = Math.min(100, hunger + 25);
  sfx.select.play().catch(console.error);
  updatePetStatsUI();
});
petContainer.appendChild(feedBtn);

function updatePetStatsUI() {
  const healthFill = document.querySelector('.health-bar-fill');
  const hungerFill = document.querySelector('.hunger-bar-fill');
  if (healthFill) healthFill.style.width = `${Math.max(0, health)}%`;
  if (hungerFill) hungerFill.style.width = `${Math.max(0, hunger)}%`;
  chrome.storage.local.set({ health: health, hunger: hunger });
}

// ---------------------------------------------------------------------------
// Health Regen/Decay Process
setInterval(() => {
  if (hunger > 0) { hunger -= 1; }
  let delta = (hunger < 50) ? -0.5 * ((50 - hunger) / 10) : 0.5 * ((hunger - 50) / 10);
  health = Math.min(100, Math.max(0, health + delta));
  updatePetStatsUI();
}, 60000);

// ---------------------------------------------------------------------------
// Progress Bar (Integrated into pet container)
function updateProgressBar() {
  petProgressBar.style.width = `${currentProgress}%`;
  petProgressText.innerText = `Level ${currentLevel}: ${currentProgress}/100`;
  chrome.storage.local.set({ currentProgress: currentProgress, currentLevel: currentLevel });
  if (currentProgress === 100 && !rewardPopupActive) {
    if (currentLevel < maxLevel) {
      currentLevel++;
      currentProgress = 0;
      health = 100;
      hunger = 100;
      updatePetStatsUI();
      rewardPopupActive = true;
      showRewardPopup();
    } else {
      console.log("Max level reached.");
    }
  }
}

function showRewardPopup() {
  let popup = document.createElement('div');
  popup.id = 'reward-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.background = '#fff';
  popup.style.color = '#000';
  popup.style.padding = '20px';
  popup.style.border = '2px solid #000';
  popup.style.zIndex = '11000';
  popup.innerHTML = `<p>Level Up! Welcome to Level ${currentLevel}.</p>`;
  
  let claimButton = document.createElement('button');
  claimButton.textContent = 'Claim Reward';
  claimButton.style.marginTop = '10px';
  popup.appendChild(claimButton);
  document.body.appendChild(popup);
  
  claimButton.addEventListener('click', () => {
    document.body.removeChild(popup);
    updateProgressBar();
    rewardPopupActive = false;
  });
}

updateProgressBar();

// ---------------------------------------------------------------------------
// Inline Calendar Options Popup
function showCalendarOptionsPopup() {
  const popup = document.createElement('div');
  popup.id = 'calendar-options-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.background = '#fff';
  popup.style.color = '#000';
  popup.style.padding = '20px';
  popup.style.border = '2px solid #000';
  popup.style.zIndex = '11000';
  popup.style.minWidth = '300px';

  const title = document.createElement('h3');
  title.innerText = 'Configure Calendar ID';
  popup.appendChild(title);

  const label = document.createElement('label');
  label.innerText = 'Calendar ID:';
  label.style.display = 'block';
  label.style.margin = '8px 0 4px 0';
  popup.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.style.width = '100%';
  input.style.padding = '5px';
  popup.appendChild(input);

  chrome.storage.sync.get('calendarId', (result) => {
    if (result.calendarId) { input.value = result.calendarId; }
  });

  const saveBtn = document.createElement('button');
  saveBtn.innerText = 'Save';
  saveBtn.style.marginTop = '10px';
  popup.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel';
  cancelBtn.style.marginTop = '10px';
  cancelBtn.style.marginLeft = '5px';
  popup.appendChild(cancelBtn);

  document.body.appendChild(popup);
  function escHandler(e) {
    if (e.key === "Escape") {
      if (document.getElementById('calendar-options-popup')) { document.body.removeChild(popup); }
      document.removeEventListener('keydown', escHandler);
    }
  }
  document.addEventListener('keydown', escHandler);

  saveBtn.addEventListener('click', () => {
    const newCalendarId = input.value.trim() || 'primary';
    chrome.storage.sync.set({ calendarId: newCalendarId }, () => {
      console.log('Calendar ID saved:', newCalendarId);
      document.body.removeChild(popup);
      document.removeEventListener('keydown', escHandler);
      refreshAssignments();
    });
  });
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(popup);
    document.removeEventListener('keydown', escHandler);
  });
}

// ---------------------------------------------------------------------------
// Customization Options Popup (UI Editor) - for assignment UI colors.
function showCustomizationOptionsPopup() {
  const popup = document.createElement('div');
  popup.id = 'customization-options-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.background = '#fff';
  popup.style.color = '#000';
  popup.style.padding = '20px';
  popup.style.border = '2px solid #000';
  popup.style.zIndex = '11000';
  popup.style.minWidth = '320px';
  popup.style.fontFamily = 'Arial, sans-serif';

  const title = document.createElement('h3');
  title.innerText = 'Customize UI Colors';
  popup.appendChild(title);

  function createColorRow(labelText, initialColor) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.marginBottom = '10px';
    const lbl = document.createElement('label');
    lbl.innerText = labelText;
    lbl.style.flex = '1';
    row.appendChild(lbl);
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = initialColor;
    colorInput.style.width = '48px';
    colorInput.style.height = '32px';
    colorInput.style.border = 'none';
    colorInput.style.cursor = 'pointer';
    row.appendChild(colorInput);
    popup.appendChild(row);
    return colorInput;
  }

  const textColorInput = createColorRow('Assignment Text:', uiSettings.uiAssignmentTextColor);
  const borderColorInput = createColorRow('Assignment Border:', uiSettings.uiAssignmentBorderColor);
  const containerBgInput = createColorRow('Assignment Background:', uiSettings.uiAssignmentBackgroundColor);
  const progressBarInput = createColorRow('Progress Bar:', uiSettings.uiProgressBarColor);

  const btnContainer = document.createElement('div');
  btnContainer.style.marginTop = '20px';
  btnContainer.style.textAlign = 'right';

  const saveBtn = document.createElement('button');
  saveBtn.innerText = 'Save';
  saveBtn.style.marginRight = '10px';
  btnContainer.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel';
  btnContainer.appendChild(cancelBtn);
  popup.appendChild(btnContainer);
  document.body.appendChild(popup);

  function escCustomizationHandler(e) {
    if (e.key === "Escape") {
      if (document.getElementById('customization-options-popup')) { document.body.removeChild(popup); }
      document.removeEventListener('keydown', escCustomizationHandler);
    }
  }
  document.addEventListener('keydown', escCustomizationHandler);

  saveBtn.addEventListener('click', () => {
    uiSettings.uiAssignmentTextColor = textColorInput.value;
    uiSettings.uiAssignmentBorderColor = borderColorInput.value;
    uiSettings.uiAssignmentBackgroundColor = containerBgInput.value;
    uiSettings.uiProgressBarColor = progressBarInput.value;
    chrome.storage.sync.set(uiSettings, () => {
      console.log('UI customization saved:', uiSettings);
      updateUICustomization();
      document.body.removeChild(popup);
      document.removeEventListener('keydown', escCustomizationHandler);
    });
  });
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(popup);
    document.removeEventListener('keydown', escCustomizationHandler);
  });
}

// ---------------------------------------------------------------------------
// Sprite Customization Popup
function showSpriteCustomizationPopup() {
  const popup = document.createElement('div');
  popup.id = 'sprite-customization-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.background = '#fff';
  popup.style.color = '#000';
  popup.style.padding = '20px';
  popup.style.border = '2px solid #000';
  popup.style.zIndex = '12000';
  popup.style.minWidth = '300px';

  const title = document.createElement('h3');
  title.innerText = 'Select Your Sprite';
  popup.appendChild(title);

  // Create dropdown for block row (0 to SPRITE_BLOCK_ROWS-1)
  const rowLabel = document.createElement('label');
  rowLabel.innerText = 'Block Row: ';
  popup.appendChild(rowLabel);
  const rowSelect = document.createElement('select');
  for (let i = 0; i < SPRITE_BLOCK_ROWS; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    if (i === selectedBlockRow) {
      option.selected = true;
    }
    rowSelect.appendChild(option);
  }
  popup.appendChild(rowSelect);

  // Create dropdown for block column (0 to SPRITE_BLOCK_COLS-1)
  const colLabel = document.createElement('label');
  colLabel.innerText = ' Block Column: ';
  popup.appendChild(colLabel);
  const colSelect = document.createElement('select');
  for (let i = 0; i < SPRITE_BLOCK_COLS; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    if (i === selectedBlockCol) {
      option.selected = true;
    }
    colSelect.appendChild(option);
  }
  popup.appendChild(colSelect);

  // Save Button
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Sprite';
  saveBtn.style.display = 'block';
  saveBtn.style.marginTop = '10px';
  popup.appendChild(saveBtn);

  // Close Button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  closeBtn.style.display = 'block';
  closeBtn.style.marginTop = '5px';
  popup.appendChild(closeBtn);

  saveBtn.addEventListener('click', () => {
    selectedBlockRow = parseInt(rowSelect.value);
    selectedBlockCol = parseInt(colSelect.value);
    // Persist the selection
    chrome.storage.local.set({
      selectedBlockRow: selectedBlockRow,
      selectedBlockCol: selectedBlockCol
    });
    // Reset animation frame for immediate feedback
    currentAnimationFrame = 0;
    drawGotchiFrame();
    document.body.removeChild(popup);
  });
  
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(popup);
  });
  
  document.body.appendChild(popup);
}

// ---------------------------------------------------------------------------
// Update UI Customization based on saved values
function updateUICustomization() {
  const assignmentsContainer = document.getElementById("assignments-list");
  if (assignmentsContainer) {
    assignmentsContainer.style.background = uiSettings.uiAssignmentBackgroundColor;
    assignmentsContainer.style.borderColor = uiSettings.uiAssignmentBorderColor;
    const labels = assignmentsContainer.querySelectorAll("label");
    labels.forEach(label => {
      label.style.color = uiSettings.uiAssignmentTextColor;
    });
  }
  petProgressBar.style.background = uiSettings.uiProgressBarColor;
}

// ---------------------------------------------------------------------------
// Add "Customize UI" button to Assignments Container header when created
function addCustomizationButton(header) {
  const customBtn = document.createElement('button');
  customBtn.textContent = 'Customize UI';
  customBtn.style.marginLeft = '10px';
  customBtn.style.fontSize = '0.8em';
  customBtn.addEventListener('click', () => {
    showCustomizationOptionsPopup();
  });
  header.appendChild(customBtn);
}

// ---------------------------------------------------------------------------
// Refresh Assignments Function and Assignments Container
function refreshAssignments() {
  // Debugging statements for the assignments tab visibility
  console.debug("Checking if calendar is authorized...", isAuthorizedDomainForCalendar());
  if (!isAuthorizedDomainForCalendar()) {
    console.debug("Not an authorized domain for assignments; skipping refresh.");
    return;
  }
  console.log("Attempting to fetch Calendar events...");
  chrome.runtime.sendMessage({ type: 'getCalendarEvents' }, (response) => {
    console.log("Calendar response:", response);
    
    const container = document.getElementById('assignments-list') || createAssignmentsContainer();
    const listContent = container.querySelector('#assignments-content');
    listContent.innerHTML = '';

    if (response.error) {
      const errP = document.createElement('p');
      errP.textContent = `Error: ${response.error}`;
      errP.style.color = '#ff8080';
      listContent.appendChild(errP);
      return;
    }
    
    let filteredEvents = (response.events || []).filter(ev => {
      const sum = ev.summary || "";
      return !sum.toLowerCase().includes("office hours");
    });
    
    filteredEvents.sort((a, b) => {
      const dateA = new Date(a.start.dateTime || a.start.date);
      const dateB = new Date(b.start.dateTime || b.start.date);
      return dateA - dateB;
    });
    
    console.log("Filtered events count:", filteredEvents.length);
    
    if (filteredEvents.length === 0) {
      console.debug("No assignments were found in the calendar.");
      const noAssignmentsMsg = document.createElement('p');
      noAssignmentsMsg.style.color = '#ff8080';
      noAssignmentsMsg.textContent = 'No assignments found in calendar.';
      listContent.appendChild(noAssignmentsMsg);
      
      const optionsButton = document.createElement('button');
      optionsButton.textContent = 'Configure Calendar ID';
      optionsButton.style.marginTop = '10px';
      optionsButton.addEventListener('click', () => {
        showCalendarOptionsPopup();
      });
      listContent.appendChild(optionsButton);
    } else {
      filteredEvents.forEach(event => {
        const rawDate = event.start.dateTime || event.start.date;
        const dateStr = rawDate ? new Date(rawDate).toLocaleDateString() : 'No Date';
        const div = document.createElement('div');
        div.className = 'assignment-item';
        div.innerHTML = `
          <label style="display: block; margin: 5px 0; color: ${uiSettings.uiAssignmentTextColor};">
            <input type="checkbox" data-id="${event.id}">
            ${event.summary}
            <small style="color: ${uiSettings.uiProgressBarColor};">${dateStr}</small>
          </label>
        `;
        const checkbox = div.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
          handleAssignmentComplete(e);
          if (e.target.checked) {
            const parentItem = e.target.closest('.assignment-item');
            if (parentItem) { parentItem.remove(); }
          }
        });
        const markBtn = document.createElement('button');
        markBtn.textContent = 'Mark Complete';
        markBtn.style.marginLeft = '8px';
        markBtn.addEventListener('click', () => {
          if (!checkbox.disabled) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
          }
        });
        div.appendChild(markBtn);
        listContent.appendChild(div);
      });
    }
    
    let todoList = document.querySelector('#todo_list');
    if (todoList) {
      console.log("Found Canvas To-Do list");
      let todoItems = todoList.querySelectorAll('.todo-item');
      todoItems.forEach(item => {
        let text = item.textContent.trim();
        const div = document.createElement('div');
        div.className = 'assignment-item';
        div.innerHTML = `
          <label style="display: block; margin: 5px 0; color: ${uiSettings.uiAssignmentTextColor};">
            <input type="checkbox" data-id="todo-${Math.random()}">
            ${text}
            <small style="color: ${uiSettings.uiProgressBarColor};">(Canvas To-Do)</small>
          </label>
        `;
        div.querySelector('input').addEventListener('change', (e) => {
          handleAssignmentComplete(e);
          if (e.target.checked) { e.target.closest('.assignment-item').remove(); }
        });
        listContent.appendChild(div);
      });
    } else {
      console.log("No Canvas To-Do list found.");
    }
  });
}

function createAssignmentsContainer() {
  const newList = document.createElement('div');
  newList.id = 'assignments-list';
  newList.style.position = 'fixed';
  // Set default position to bottom left.
  newList.style.left = '';
  newList.style.bottom = '80px';
  // Clear any top/right properties:
  newList.style.top = '';
  newList.style.right = '60px';
  // Set a high z-index so that it is in front of everything.
  newList.style.zIndex = "15000";
  newList.style.background = uiSettings.uiAssignmentBackgroundColor;
  newList.style.border = '2px solid ' + uiSettings.uiAssignmentBorderColor;
  newList.style.width = '300px';
  newList.style.height = 'auto';
  newList.style.maxHeight = '50vh';
  newList.style.overflowY = 'auto';
  newList.style.padding = '0';
  newList.style.boxSizing = 'border-box';

  chrome.storage.local.get('assignmentsListPositionBottomLeft', (data) => {
    if (data.assignmentsListPositionBottomLeft) {
      if (data.assignmentsListPositionBottomLeft.left) {
        newList.style.left = data.assignmentsListPositionBottomLeft.left;
      }
      if (data.assignmentsListPositionBottomLeft.bottom) {
        newList.style.bottom = data.assignmentsListPositionBottomLeft.bottom;
      }
    }
  });

  const listHeader = document.createElement('div');
  listHeader.style.background = '#2d2d2d';
  listHeader.style.color = '#fff';
  listHeader.style.padding = '5px';
  listHeader.style.cursor = 'grab';
  listHeader.innerText = 'Assignments';
  addCustomizationButton(listHeader);
  newList.appendChild(listHeader);

  const listContent = document.createElement('div');
  listContent.id = 'assignments-content';
  listContent.style.padding = '10px';
  newList.appendChild(listContent);

  const resizeHandle = document.createElement('div');
  resizeHandle.style.width = '15px';
  resizeHandle.style.height = '15px';
  resizeHandle.style.background = '#cccccc';
  resizeHandle.style.position = 'absolute';
  resizeHandle.style.right = '0';
  resizeHandle.style.bottom = '0';
  resizeHandle.style.cursor = 'nwse-resize';
  newList.appendChild(resizeHandle);

  document.body.appendChild(newList);
  // Use the modified header-drag function that stores left & bottom.
  makeHeaderDraggable(listHeader, newList, 'assignmentsListPositionBottomLeft');
  makeResizable(newList, resizeHandle);
  return newList;
}

// ---------------------------------------------------------------------------
// On load, refresh assignments if authorized.
if (isAuthorizedDomainForCalendar()) {
  refreshAssignments();
}

// ---------------------------------------------------------------------------
// Assignment Completion Handler
function handleAssignmentComplete(e) {
  if (e.target.checked) {
    let randomIncrease = Math.floor(Math.random() * (25 - 10 + 1)) + 10;
    let remaining = 100 - currentProgress;
    if (randomIncrease > remaining) { randomIncrease = remaining; }
    currentProgress += randomIncrease;
    updateProgressBar();
    const today = new Date().toDateString();
    if (lastFedDate === today) return;
    streak = lastFedDate?.getDate() === new Date().getDate() - 1 ? streak + 1 : 1;
    lastFedDate = new Date();
    sfx.select.play().catch(console.error);
    const currentMood = happiness > 70 ? 'happy' :
      happiness > 40 ? 'neutral' :
      streak > 3 ? 'excited' : 'sad';
    if (currentMood === 'excited') {
      setTimeout(() => sfx.sparkle.play().catch(console.error), 300);
    } else {
      const sound = happiness > 70 ? sfx.happy : sfx.sad;
      sound.play().catch(console.error);
    }
    isCelebrating = true;
    let celebrationFrame = 0;
    const celebrationInterval = setInterval(() => {
      if (celebrationFrame >= 147) {
        // End celebration
        isCelebrating = false;
        clearInterval(celebrationInterval);
      } else {
        celebrationFrame++;
      }
    }, CELEBRATION_FRAME_INTERVAL);
    chrome.runtime.sendMessage({ type: 'submission' });
    e.target.disabled = true;
  }
}

// ---------------------------------------------------------------------------
// Draggable/Resizable Helpers
function makeDraggable(element, storageKey) {
  element.style.userSelect = 'none';
  let isDragging = false, offsetX = 0, offsetY = 0;
  element.style.position = 'fixed';
  element.style.cursor = 'grab';
  chrome.storage.local.get(storageKey, (data) => {
    if (data[storageKey]) {
      element.style.left = data[storageKey].left;
      element.style.top = data[storageKey].top;
    }
  });
  element.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    element.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      element.style.left = `${e.clientX - offsetX}px`;
      element.style.top = `${e.clientY - offsetY}px`;
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'grab';
      chrome.storage.local.set({ [storageKey]: { left: element.style.left, top: element.style.top } });
    }
  });
  element.addEventListener('touchstart', (e) => {
    isDragging = true;
    offsetX = e.touches[0].clientX - element.offsetLeft;
    offsetY = e.touches[0].clientY - element.offsetTop;
    element.style.cursor = 'grabbing';
  });
  document.addEventListener('touchmove', (e) => {
    if (isDragging) {
      e.preventDefault();
      element.style.left = `${e.touches[0].clientX - offsetX}px`;
      element.style.top = `${e.touches[0].clientY - offsetY}px`;
    }
  });
  document.addEventListener('touchend', () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'grab';
      chrome.storage.local.set({ [storageKey]: { left: element.style.left, top: element.style.top } });
    }
  });
}

// Modified header-draggable for assignments container (saves left and bottom)
function makeHeaderDraggable(header, container, storageKey) {
  header.style.userSelect = 'none';
  let isDragging = false, offsetX = 0, offsetY = 0;
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - container.offsetLeft;
    // Calculate offset from container bottom:
    offsetY = e.clientY - (window.innerHeight - container.offsetHeight - parseInt(getComputedStyle(container).bottom || "0", 10));
    header.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      container.style.left = `${e.clientX - offsetX}px`;
      // New bottom = window height - (new top + container height)
      const newTop = e.clientY - offsetY;
      const newBottom = window.innerHeight - (newTop + container.offsetHeight);
      container.style.bottom = `${newBottom}px`;
      // Clear any "top" value
      container.style.top = "";
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = 'grab';
      chrome.storage.local.set({ 
        [storageKey]: { 
          left: container.style.left, 
          bottom: container.style.bottom 
        } 
      });
    }
  });
}

// Standard resizable helper
function makeResizable(container, handle) {
  let isResizing = false, startX, startY, startWidth, startHeight;
  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(window.getComputedStyle(container).width, 10);
    startHeight = parseInt(window.getComputedStyle(container).height, 10);
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('mousemove', (e) => {
    if (isResizing) {
      container.style.width = (startWidth + e.clientX - startX) + 'px';
      container.style.height = (startHeight + e.clientY - startY) + 'px';
      e.preventDefault();
    }
  });
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Escape Key Handler to Close Popups
document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    const popupIds = ["calendar-options-popup", "customization-options-popup", "reward-popup", "test-menu-popup", "sprite-customization-popup"];
    popupIds.forEach(id => {
      const popup = document.getElementById(id);
      if (popup) {
        document.body.removeChild(popup);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Test Menu Popup (Re-added for debugging/testing)
if (isCanvasDomain()) {
  const testMenuButton = document.createElement('button');
  testMenuButton.textContent = 'Test Menu';
  testMenuButton.style.position = 'fixed';
  testMenuButton.style.bottom = '10px';
  testMenuButton.style.left = '10px';
  testMenuButton.style.zIndex = '10000';
  document.body.appendChild(testMenuButton);
  testMenuButton.addEventListener('click', () => { showTestMenuPopup(); });

  function showTestMenuPopup() {
    const popup = document.createElement('div');
    popup.id = 'test-menu-popup';
    popup.style.position = 'fixed';
    popup.style.bottom = '50px';
    popup.style.left = '10px';
    popup.style.background = '#fff';
    popup.style.color = '#000';
    popup.style.padding = '10px';
    popup.style.border = '2px solid #000';
    popup.style.zIndex = '11000';
    // Add test buttons or debugging information here
    const simButton = document.createElement('button');
    simButton.textContent = 'Simulate Assignment Completion';
    simButton.style.display = 'block';
    simButton.style.marginBottom = '5px';
    simButton.addEventListener('click', () => {
      let randomIncrease = Math.floor(Math.random() * (25 - 10 + 1)) + 10;
      let remaining = 100 - currentProgress;
      if (randomIncrease > remaining) { randomIncrease = remaining; }
      currentProgress += randomIncrease;
      updateProgressBar();
    });
    popup.appendChild(simButton);
    
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Level & Progress';
    resetButton.style.display = 'block';
    resetButton.style.marginBottom = '5px';
    resetButton.addEventListener('click', () => {
      currentLevel = 1;
      currentProgress = 0;
      updateProgressBar();
    });
    popup.appendChild(resetButton);
    
    const testHealthBtn = document.createElement('button');
    testHealthBtn.textContent = 'Test Health Regen';
    testHealthBtn.style.display = 'block';
    testHealthBtn.style.marginBottom = '5px';
    testHealthBtn.addEventListener('click', () => {
      // Apply a temporary delta for testing
      health = Math.min(100, Math.max(0, health + 10));
      updatePetStatsUI();
    });
    popup.appendChild(testHealthBtn);
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.display = 'block';
    closeButton.addEventListener('click', () => { document.body.removeChild(popup); });
    popup.appendChild(closeButton);
    
    document.body.appendChild(popup);
  }
}
