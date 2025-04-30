// content.js

(function () {
  const API_ROOT             = "https://canvagotchi-kv.canvagotchi.workers.dev";
  const UI_SETTINGS_ENDPOINT = `${API_ROOT}/api/ui-settings`;
  const SETTINGS_PAGE_URL    = `${API_ROOT}/settings.html`;

  function isCanvasDomain() {
    const host = window.location.host.toLowerCase();
    return host.includes("canvas") || host === "uncc.instructure.com";
  }
  if (!isCanvasDomain()) return;

  const BACKEND_BULK_UPSERT = `${API_ROOT}/api/assignments/bulk_upsert/`;
  document.body.style.setProperty("overflow", "auto", "important");

  // ---------------------------------------------------------------------------
  // Remote & default UI settings
  const defaultUISettings = {
    uiAssignmentTextColor:       "#92d4a7",
    uiAssignmentBorderColor:     "#92d4a7",
    uiAssignmentBackgroundColor: "#1a1a1a",
    uiProgressBarColor:          "#6b8cff"
  };
  let uiSettings = { ...defaultUISettings };

  async function loadRemoteUISettings() {
    try {
      const res  = await fetch(UI_SETTINGS_ENDPOINT);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      uiSettings = {
        uiAssignmentTextColor:       data.assignment_text_color,
        uiAssignmentBorderColor:     data.assignment_border_color,
        uiAssignmentBackgroundColor: data.assignment_background_color,
        uiProgressBarColor:          data.progress_bar_color
      };
      updateUICustomization();
    } catch (e) {
      console.warn("Failed to load remote UI settings:", e);
    }
    chrome.storage.local.get(
      ["selectedBlockRow","selectedBlockCol"],
      data => {
        if (data.selectedBlockRow !== undefined) selectedRow = data.selectedBlockRow;
        if (data.selectedBlockCol !== undefined) selectedCol = data.selectedBlockCol;
        updateCanvasSize();
        drawFrame();
        refreshAssignments();
      }
    );
  }

  if (typeof chrome?.runtime?.onMessage !== "undefined") {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "refresh-ui") {
        loadRemoteUISettings();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Persisted state
  let currentProgress      = 0,
      currentLevel         = 1,
      rewardPopupActive    = false,
      maxLevel             = 20,
      spriteScale          = 3,
      completedAssignments = [],
      inventory            = { apple: 0, cookie: 0, steak: 0 },
      health               = 100,
      hunger               = 100;

  const foodConfig = {
    apple:  { name: "Apple",  hunger: 10 },
    cookie: { name: "Cookie", hunger: 20 },
    steak:  { name: "Steak",  hunger: 30 }
  };

  chrome.storage.local.get(
    ["currentProgress","currentLevel","completedAssignments","spriteScale","inventory","health","hunger"],
    data => {
      if (data.currentProgress     !== undefined) currentProgress      = data.currentProgress;
      if (data.currentLevel        !== undefined) currentLevel         = data.currentLevel;
      if (Array.isArray(data.completedAssignments)) completedAssignments = data.completedAssignments;
      if (data.inventory && typeof data.inventory === "object") inventory = data.inventory;
      if (data.spriteScale        !== undefined) spriteScale          = data.spriteScale;
      if (data.health             !== undefined) health               = data.health;
      if (data.hunger             !== undefined) hunger               = data.hunger;
      updateProgressBar();
      updateStatsUI();
      updateInventoryUI();
    }
  );

  // ---------------------------------------------------------------------------
  // Canvas & sprite setup
  const canvasElem = document.createElement("canvas");
  const ctx        = canvasElem.getContext("2d");
  let gotchiSprite    = new Image(),
      gotchiLoaded    = false,
      currentFrame    = 0,
      SPRITE_BLOCKS_X = 4,
      SPRITE_BLOCKS_Y = 2,
      FRAME_COLS      = 3,
      FRAME_ROWS      = 4,
      blockW, blockH,
      frameW, frameH,
      selectedRow = 0,
      selectedCol = 1;

  chrome.storage.local.get(["selectedBlockRow","selectedBlockCol"], data => {
    if (data.selectedBlockRow !== undefined) selectedRow = data.selectedBlockRow;
    if (data.selectedBlockCol !== undefined) selectedCol = data.selectedBlockCol;
  });

  gotchiSprite.src = chrome.runtime.getURL("icons/icon48.png");
  gotchiSprite.onload = () => {
    gotchiLoaded = true;
    blockW  = gotchiSprite.width  / SPRITE_BLOCKS_X;
    blockH  = gotchiSprite.height / SPRITE_BLOCKS_Y;
    frameW  = blockW  / FRAME_COLS;
    frameH  = blockH  / FRAME_ROWS;
    updateCanvasSize();
    setInterval(() => {
      currentFrame = (currentFrame + 1) % (FRAME_COLS * FRAME_ROWS);
      drawFrame();
    }, 200);
  };

  function updateCanvasSize() {
    canvasElem.width  = frameW * spriteScale;
    canvasElem.height = frameH * spriteScale;
  }
  function drawFrame() {
    if (!gotchiLoaded) return;
    const row = Math.floor(currentFrame / FRAME_COLS),
          col = currentFrame % FRAME_COLS,
          sx  = selectedCol * blockW + col * frameW,
          sy  = selectedRow * blockH + row * frameH;
    ctx.clearRect(0,0,canvasElem.width,canvasElem.height);
    ctx.drawImage(
      gotchiSprite,
      sx, sy, frameW, frameH,
      0, 0, canvasElem.width, canvasElem.height
    );
  }

  // ---------------------------------------------------------------------------
  // Inline customization popups
  function showCustomizationOptionsPopup(){
    if (document.getElementById("customization-options-popup")) return;
    const popup = document.createElement("div");
    popup.id = "customization-options-popup";
    Object.assign(popup.style, {
      position:  "fixed",
      top:       "50%",
      left:      "50%",
      transform: "translate(-50%,-50%)",
      background:"#fff",
      color:     "#000",
      padding:   "20px",
      border:    "2px solid #000",
      zIndex:    "11000",
      minWidth:  "300px",
      fontFamily:"Arial, sans-serif",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
    });
    popup.innerHTML = `
      <h3>Customize UI Colors</h3>
      <div style="margin-bottom:10px"><label>Assignment Text: <input type="color" id="c-text"  value="${uiSettings.uiAssignmentTextColor}"></label></div>
      <div style="margin-bottom:10px"><label>Assignment Border: <input type="color" id="c-border" value="${uiSettings.uiAssignmentBorderColor}"></label></div>
      <div style="margin-bottom:10px"><label>Assignment Background: <input type="color" id="c-bg"    value="${uiSettings.uiAssignmentBackgroundColor}"></label></div>
      <div style="margin-bottom:20px"><label>Progress Bar: <input type="color" id="c-prog" value="${uiSettings.uiProgressBarColor}"></label></div>
      <button id="c-save"   style="margin-right:10px">Save</button>
      <button id="c-cancel">Cancel</button>
    `;
    document.body.appendChild(popup);
    document.getElementById("c-cancel").onclick = () => popup.remove();
    document.getElementById("c-save").onclick   = () => {
      uiSettings.uiAssignmentTextColor       = document.getElementById("c-text").value;
      uiSettings.uiAssignmentBorderColor     = document.getElementById("c-border").value;
      uiSettings.uiAssignmentBackgroundColor = document.getElementById("c-bg").value;
      uiSettings.uiProgressBarColor          = document.getElementById("c-prog").value;
      chrome.storage.sync.set(uiSettings, updateUICustomization);
      popup.remove();
    };
  }

  function showSpriteCustomizationPopup(){
    if (document.getElementById("sprite-customization-popup")) return;
    const popup = document.createElement("div");
    popup.id = "sprite-customization-popup";
    Object.assign(popup.style, {
      position:  "fixed",
      top:       "50%",
      left:      "50%",
      transform: "translate(-50%,-50%)",
      background:"#fff",
      color:     "#000",
      padding:   "20px",
      border:    "2px solid #000",
      zIndex:    "11000",
      minWidth:  "300px",
      fontFamily:"Arial, sans-serif",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
    });
    popup.innerHTML = `
      <h3>Customize Gotchi Sprite</h3>
      <div style="margin-bottom:10px"><label>Row:
        <select id="s-row">${[...Array(SPRITE_BLOCKS_Y).keys()]
          .map(i=>`<option value="${i}" ${i===selectedRow?"selected":""}>${i}</option>`).join("")}
        </select>
      </label></div>
      <div style="margin-bottom:10px"><label>Col:
        <select id="s-col">${[...Array(SPRITE_BLOCKS_X).keys()]
          .map(i=>`<option value="${i}" ${i===selectedCol?"selected":""}>${i}</option>`).join("")}
        </select>
      </label></div>
      <div style="margin-bottom:20px"><label>Scale: <input type="range" id="s-scale" min="1" max="10" value="${spriteScale}"></label></div>
      <button id="s-save"   style="margin-right:10px">Save</button>
      <button id="s-cancel">Cancel</button>
    `;
    document.body.appendChild(popup);
    document.getElementById("s-cancel").onclick = () => popup.remove();
    document.getElementById("s-save").onclick   = () => {
      selectedRow = parseInt(document.getElementById("s-row").value, 10);
      selectedCol = parseInt(document.getElementById("s-col").value, 10);
      spriteScale = parseInt(document.getElementById("s-scale").value, 10);
      chrome.storage.local.set({ selectedBlockRow: selectedRow, selectedBlockCol: selectedCol, spriteScale }, () => {
        updateCanvasSize();
        drawFrame();
      });
      popup.remove();
    };
  }

  // ---------------------------------------------------------------------------
  // UI application
  function updateUICustomization() {
    const pb = document.getElementById("pet-progress-bar");
    if (pb) pb.style.background = uiSettings.uiProgressBarColor;
    const panel = document.getElementById("assignments-list");
    if (panel) {
      panel.style.background  = uiSettings.uiAssignmentBackgroundColor;
      panel.style.borderColor = uiSettings.uiAssignmentBorderColor;
      panel.querySelectorAll("label").forEach(lbl => lbl.style.color = uiSettings.uiAssignmentTextColor);
    }
  }

  // ---------------------------------------------------------------------------
  // Build the pet & assignment UI
  const petContainer = document.createElement("div");
  Object.assign(petContainer.style, {
    position:    "fixed",
    top:         "20px",
    left:        "20px",
    padding:     "10px",
    background:  "#1e1e1e",
    border:      "2px solid #aaa",
    borderRadius:"8px",
    boxShadow:   "0 4px 12px rgba(0,0,0,0.5)",
    cursor:      "grab",
    zIndex:      "9999",
    textAlign:   "center"
  });
  canvasElem.style.display = "block";
  canvasElem.style.margin  = "0 auto";
  petContainer.appendChild(canvasElem);

  // Progress
  const progressWrap = document.createElement("div");
  Object.assign(progressWrap.style, { marginTop:"8px", background:"#333", height:"12px", borderRadius:"5px", overflow:"hidden" });
  const progressBar = document.createElement("div");
  progressBar.id = "pet-progress-bar";
  Object.assign(progressBar.style, { width:"0%", height:"100%", transition:"width .3s ease", background:uiSettings.uiProgressBarColor });
  progressWrap.appendChild(progressBar);
  const progressText = document.createElement("div");
  progressText.id = "pet-progress-text";
  Object.assign(progressText.style, { textAlign:"center", color:"#fff", marginTop:"4px", fontSize:"14px" });
  petContainer.appendChild(progressWrap);
  petContainer.appendChild(progressText);

  // Inventory
  const inventoryContainer = document.createElement("div");
  inventoryContainer.style.marginTop = "8px";
  petContainer.appendChild(inventoryContainer);

  function updateInventoryUI() {
    inventoryContainer.innerHTML = "";
    Object.keys(foodConfig).forEach(key => {
      const item  = foodConfig[key], count = inventory[key]||0;
      const btn = document.createElement("button");
      btn.textContent = `${item.name} (${count}) [+${item.hunger}]`;
      btn.disabled   = count===0;
      btn.style.marginRight = "6px";
      btn.onclick = () => {
        inventory[key] = Math.max(0, inventory[key]-1);
        hunger = Math.min(100, hunger + item.hunger);
        chrome.storage.local.set({ inventory });
        updateStatsUI();
        updateInventoryUI();
      };
      inventoryContainer.appendChild(btn);
    });
  }

  // Under the gotchi, open the inline sprite customizer
  const spriteBtn = document.createElement("button");
  spriteBtn.textContent = "Customize Gotchi";
  Object.assign(spriteBtn.style, { marginTop:"8px", width:"100%", padding:"6px", border:"none", borderRadius:"4px", background:"#444", color:"#fff", cursor:"pointer" });
  spriteBtn.onclick = showSpriteCustomizationPopup;
  petContainer.appendChild(spriteBtn);

  document.body.appendChild(petContainer);
  makeDraggable(petContainer, "petContainerPos");

  // Health & Hunger bars
  function createStatBar(label,id,color){
    const w = document.createElement("div"); w.style.margin="6px 0";
    const lbl = document.createElement("div"); lbl.innerText = label; lbl.style.color="#fff"; lbl.style.fontSize="12px";
    const bar = document.createElement("div"); bar.id=id;
    Object.assign(bar.style, { background:"#333", border:"1px solid #888", borderRadius:"5px", overflow:"hidden", height:"12px" });
    const fill = document.createElement("div"); fill.className = id+"-fill";
    fill.style = `width:100%;height:100%;background:${color};transition:width .3s`;
    bar.appendChild(fill); w.appendChild(lbl); w.appendChild(bar);
    return w;
  }
  petContainer.appendChild(createStatBar("Health","health-bar","#78d67d"));
  petContainer.appendChild(createStatBar("Hunger","hunger-bar","#e2ad3b"));

  function updateStatsUI(){
    const hf = document.querySelector(".health-bar-fill"), uf = document.querySelector(".hunger-bar-fill");
    if(hf) hf.style.width = `${health}%`;
    if(uf) uf.style.width = `${hunger}%`;
    chrome.storage.local.set({ health,hunger });
  }
  setInterval(() => {
    if(hunger>0) hunger--;
    const delta = hunger<50 ? -0.5*((50-hunger)/10) : 0.5*((hunger-50)/10);
    health = Math.min(100, Math.max(0, health + delta));
    updateStatsUI();
  }, 60000);

  // Progress & level-up
  function grantFoodReward(){
    let counts={apple:0,cookie:0,steak:0};
    const n = Math.floor(Math.random()*5)+1;
    for(let i=0;i<n;i++){
      const keys = Object.keys(foodConfig), choice = keys[Math.floor(Math.random()*keys.length)];
      inventory[choice] = (inventory[choice]||0)+1;
      counts[choice]++;
    }
    chrome.storage.local.set({ inventory });
    return counts;
  }
  function updateProgressBar(){
    progressBar.style.width = `${currentProgress}%`;
    progressText.textContent = `Level ${currentLevel}: ${currentProgress}/100`;
    chrome.storage.local.set({ currentProgress,currentLevel });
    if(currentProgress===100 && !rewardPopupActive){
      if(currentLevel<maxLevel){
        currentLevel++;
        currentProgress=0;
        health=hunger=100;
        updateStatsUI();
        const rewards = grantFoodReward();
        rewardPopupActive = true;
        showLevelUpPopup(rewards);
      }
    }
  }
  function showLevelUpPopup(rewardCounts){
    const p = document.createElement("div"); p.id="levelup-popup";
    Object.assign(p.style, { position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", background:"#fff", color:"#000", padding:"20px", border:"2px solid #000", zIndex:"11000" });
    let html = `<p>🎉 Level ${currentLevel} Unlocked! 🎉</p><p>You received:</p><ul>`;
    Object.keys(rewardCounts).forEach(k => {
      if(rewardCounts[k]>0) html+=`<li>${rewardCounts[k]}× ${foodConfig[k].name}</li>`;
    });
    html+="</ul>";
    p.innerHTML = html;
    const btn = document.createElement("button");
    btn.textContent = "Claim"; btn.style.marginTop="10px";
    btn.onclick = () => { p.remove(); rewardPopupActive=false; updateInventoryUI(); updateProgressBar(); };
    p.appendChild(btn);
    document.body.appendChild(p);
  }
  updateProgressBar();
  updateInventoryUI();

  // submission observers
  function observeSubmissionBanner(){
    const observer = new MutationObserver(mutations=>{
      mutations.forEach(m=>{
        m.addedNodes.forEach(node=>{
          if(node.nodeType===1 && node.matches(".ic-notification__message") && /successfully submitted/i.test(node.textContent)){
            markThisAssignmentComplete();
          }
        });
      });
    });
    observer.observe(document.body,{ childList:true, subtree:true });
  }
  function observeSubmissionSidebar(){
    const observer = new MutationObserver(mutations=>{
      mutations.forEach(m=>{
        m.addedNodes.forEach(node=>{
          if(node.nodeType===1 && /Submitted!/.test(node.textContent)){
            markThisAssignmentComplete();
          }
        });
      });
    });
    observer.observe(document.body,{ childList:true, subtree:true });
  }
  observeSubmissionBanner();
  observeSubmissionSidebar();
  function markThisAssignmentComplete(){
    const m = window.location.pathname.match(/\/courses\/\d+\/assignments\/(\d+)/);
    if(!m) return;
    const id = m[1];
    if(completedAssignments.includes(id)) return;
    let inc = Math.floor(Math.random()*(25-10+1))+10;
    if(inc>100-currentProgress) inc=100-currentProgress;
    currentProgress+=inc;
    updateProgressBar();
    completedAssignments.push(id);
    chrome.storage.local.set({ completedAssignments });
    refreshAssignments();
  }

  // sync & assignments panel, drag, test-menu, etc.
  async function syncCanvasToBackend(daysOut=30){
    try {
      const start=new Date(), end=new Date();
      end.setDate(end.getDate()+daysOut);
      const url = `${window.location.origin}/api/v1/planner/items?start_date=${start.toISOString().slice(0,10)}&end_date=${end.toISOString().slice(0,10)}&per_page=100`;
      const resp = await fetch(url,{ credentials:"include" });
      if(!resp.ok) throw new Error(`Canvas planner ${resp.status}`);
      const raw = await resp.json();
      const data=raw.filter(it=>it.plannable_type==="assignment").map(it=>({
        id:it.plannable.id,
        title:it.plannable.title,
        context_name:it.course_name||it.context_name,
        html_url:it.html_url,
        due_at:it.plannable.due_at
      }));
      await fetch(BACKEND_BULK_UPSERT,{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
    } catch(err){
      console.warn("Canvagotchi sync failed:",err);
    }
  }

  function addCustomizationButton(header){
    const btn = document.createElement("button");
    btn.textContent   = "Customize UI";
    btn.style.marginLeft = "10px";
    btn.style.fontSize   = "0.8em";
    btn.onclick = () => window.open(SETTINGS_PAGE_URL, "_blank");
    header.appendChild(btn);
  }

  async function getCompletedAssignments(){
    return new Promise(res=>
      chrome.storage.local.get("completedAssignments",data=>
        res(Array.isArray(data.completedAssignments)?data.completedAssignments:[])
      )
    );
  }

  async function getCanvasAssignments(daysOut=30){
    const start=new Date(), end=new Date();
    end.setDate(end.getDate()+daysOut);
    const s=start.toISOString().slice(0,10), e=end.toISOString().slice(0,10);
    let url=`${window.location.origin}/api/v1/planner/items?start_date=${s}&end_date=${e}&per_page=100`, all=[];
    while(url){
      const resp = await fetch(url,{credentials:"include"});
      if(!resp.ok) throw new Error("Planner API "+resp.status);
      const page = await resp.json();
      all.push(...page.filter(it=>it.plannable_type==="assignment"));
      const link = resp.headers.get("Link")||"", m=link.match(/<([^>]+)>;\s*rel="next"/);
      url = m?m[1]:null;
    }
    return all;
  }

  async function buildWeightMap(courseId){
    const gResp = await fetch(`${window.location.origin}/api/v1/courses/${courseId}/assignment_groups?per_page=100`,{credentials:"include"});
    if(!gResp.ok) throw new Error("Groups API "+gResp.status);
    const groups = await gResp.json(), groupWeight={};
    groups.forEach(g=>groupWeight[g.id]=g.group_weight||0);
    const aResp = await fetch(`${window.location.origin}/api/v1/courses/${courseId}/assignments?per_page=100`,{credentials:"include"});
    if(!aResp.ok) throw new Error("Assignments API "+aResp.status);
    const assigns = await aResp.json(), wmap={};
    assigns.forEach(a=>wmap[a.id]=groupWeight[a.assignment_group_id]||0);
    return wmap;
  }

  function getCurrentCourseId(){
    const m=window.location.pathname.match(/\/courses\/(\d+)/);
    return m?Number(m[1]):null;
  }

  function createAssignmentsContainer(){
    const panel = document.createElement("div");
    panel.id = "assignments-list";
    Object.assign(panel.style,{
      position:"fixed", bottom:"80px", right:"60px",
      background:uiSettings.uiAssignmentBackgroundColor,
      border:`2px solid ${uiSettings.uiAssignmentBorderColor}`,
      zIndex:"15000", padding:"0", boxSizing:"border-box",
      resize:"both", overflow:"auto", width:"300px", maxHeight:"50vh"
    });
    chrome.storage.local.get("assignmentsPos",data=>{ if(data.assignmentsPos) Object.assign(panel.style,data.assignmentsPos); });
    chrome.storage.local.get("assignmentsSize",data=>{ if(data.assignmentsSize){ panel.style.width=data.assignmentsSize.width; panel.style.height=data.assignmentsSize.height;} });
    const hdr = document.createElement("div");
    hdr.innerText = "Assignments";
    Object.assign(hdr.style,{ background:"#2d2d2d", color:"#fff", padding:"5px", cursor:"grab" });
    addCustomizationButton(hdr);
    panel.appendChild(hdr);
    const content = document.createElement("div");
    content.id    = "assignments-content";
    content.style = "padding:10px";
    panel.appendChild(content);
    document.body.appendChild(panel);
    makeHeaderDraggable(hdr,panel,"assignmentsPos");
    panel.addEventListener("mouseup",()=>{
      chrome.storage.local.set({ assignmentsSize:{ width:panel.style.width, height:panel.style.height } });
    });
    return panel;
  }

  async function refreshAssignments(){
    const completed = await getCompletedAssignments();
    let items;
    try { items = await getCanvasAssignments(); }
    catch(err){
      console.error(err);
      const p = createAssignmentsContainer();
      p.querySelector("#assignments-content").innerHTML = `<p style="color:#f88">Failed to load assignments.</p>`;
      return;
    }
    items = items.filter(it => !completed.includes(String(it.plannable.id)));
    const courseId = getCurrentCourseId();
    let weightMap = null;
    if(courseId!==null){
      try { weightMap = await buildWeightMap(courseId); }
      catch(e){ console.warn("Weight map failed:",e); }
      items = items.filter(it=>it.course_id===courseId);
    }
    const panel   = document.getElementById("assignments-list")||createAssignmentsContainer();
    const content = panel.querySelector("#assignments-content");
    content.innerHTML = "";
    if(items.length===0){
      content.innerHTML = `<p style="color:#f88">${courseId?"No uncompleted assignments for this course.":"No upcoming assignments found."}</p>`;
      return;
    }
    items.sort((a,b)=>new Date(a.plannable.due_at)-new Date(b.plannable.due_at));
    items.forEach(it=>{
      const due = new Date(it.plannable.due_at).toLocaleDateString();
      const div = document.createElement("div");
      div.className = "assignment-item";
      const w = weightMap&&weightMap[it.plannable.id]!=null?weightMap[it.plannable.id]:null;
      div.innerHTML = `
        <label style="display:block;margin:5px 0;color:${uiSettings.uiAssignmentTextColor};">
          <input type="checkbox" data-id="${it.plannable.id}" ${w!=null?`data-weight="${w}"`:``}>
          ${it.plannable.title}
          <small style="color:${uiSettings.uiProgressBarColor};margin-left:4px">${due}</small>
        </label>`;
      const cb = div.querySelector("input");
      cb.addEventListener("change", handleAssignmentComplete);
      content.appendChild(div);
    });
  }
  async function handleAssignmentComplete(e){
    if(!e.target.checked) return;
    const id     = String(e.target.dataset.id),
          wField = e.target.dataset.weight,
          weight = wField!=null?parseFloat(wField):null;
    let inc = weight>0?weight:Math.floor(Math.random()*(25-10+1))+10;
    if(inc>100-currentProgress) inc=100-currentProgress;
    currentProgress+=inc;
    updateProgressBar();
    completedAssignments.push(id);
    chrome.storage.local.set({ completedAssignments });
    refreshAssignments();
  }

  function makeDraggable(el,key){
    el.style.userSelect = "none"; el.style.position="fixed"; el.style.cursor="grab";
    let drag=false, ox=0, oy=0;
    chrome.storage.local.get(key,data=>{ if(data[key]){ el.style.left=data[key].left; el.style.top=data[key].top; } });
    el.addEventListener("mousedown", e=>{ drag=true; ox=e.clientX-el.offsetLeft; oy=e.clientY-el.offsetTop; el.style.cursor="grabbing"; });
    document.addEventListener("mousemove", e=>{ if(!drag) return; el.style.left=`${e.clientX-ox}px`; el.style.top=`${e.clientY-oy}px`; });
    document.addEventListener("mouseup", ()=>{ if(!drag) return; drag=false; el.style.cursor="grab"; chrome.storage.local.set({ [key]:{ left:el.style.left, top:el.style.top } }); });
  }
  function makeHeaderDraggable(header,container,key){
    header.style.userSelect="none";
    let drag=false, ox=0, oy=0;
    header.addEventListener("mousedown", e=>{ drag=true; ox=e.clientX-container.offsetLeft; oy=e.clientY-(window.innerHeight-container.offsetHeight-parseInt(getComputedStyle(container).bottom||"0")); header.style.cursor="grabbing"; });
    document.addEventListener("mousemove", e=>{ if(!drag) return; container.style.left=`${e.clientX-ox}px`; const top=e.clientY-oy; container.style.bottom=`${window.innerHeight-(top+container.offsetHeight)}px`; container.style.top=""; });
    document.addEventListener("mouseup", ()=>{ if(!drag) return; drag=false; header.style.cursor="grab"; chrome.storage.local.set({ [key]:{ left:container.style.left, bottom:container.style.bottom } }); });
  }

  setTimeout(refreshAssignments, 500);
  setInterval(refreshAssignments, 60000);
  setTimeout(() => syncCanvasToBackend(), 1000);
  setInterval(() => syncCanvasToBackend(), 5 * 60 * 1000);
  loadRemoteUISettings();

  // ---------------------------------------------------------------------------
  // TEST MENU — bottom-left
  if (isCanvasDomain()) {
    const tmBtn = document.createElement("button");
    tmBtn.textContent = "Test Menu";
    Object.assign(tmBtn.style, {
      position:   "fixed",
      bottom:     "10px",
      left:       "10px",
      zIndex:     "10000",
      padding:    "6px 8px",
      background: "#444",
      color:      "#fff",
      border:     "none",
      borderRadius:"4px",
      cursor:     "pointer"
    });
    document.body.appendChild(tmBtn);
    tmBtn.addEventListener("click", showTestMenuPopup);

    function showTestMenuPopup() {
      if (document.getElementById("test-menu-popup")) return;
      const popup = document.createElement("div");
      popup.id = "test-menu-popup";
      Object.assign(popup.style, {
        position:   "fixed",
        bottom:     "50px",
        left:       "10px",
        background: "#fff",
        color:      "#000",
        padding:    "10px",
        border:     "2px solid #000",
        zIndex:     "11000"
      });

      // Simulate submission
      const sim = document.createElement("button");
      sim.textContent = "Simulate Submission";
      sim.style.display = "block";
      sim.style.marginBottom = "5px";
      sim.onclick = () => { markThisAssignmentComplete(); };
      popup.appendChild(sim);

      // Reset Level & Progress
      const resetLP = document.createElement("button");
      resetLP.textContent = "Reset Level & Progress";
      resetLP.style.display = "block";
      resetLP.style.marginBottom = "5px";
      resetLP.onclick = () => {
        currentLevel = 1;
        currentProgress = 0;
        chrome.storage.local.set({ currentLevel, currentProgress }, updateProgressBar);
      };
      popup.appendChild(resetLP);

      // Reset Completed List
      const resetList = document.createElement("button");
      resetList.textContent = "Reset Completed List";
      resetList.style.display = "block";
      resetList.style.marginBottom = "5px";
      resetList.onclick = () => {
        completedAssignments = [];
        chrome.storage.local.set({ completedAssignments }, refreshAssignments);
      };
      popup.appendChild(resetList);

      // Hide Test Menu
      const hide = document.createElement("button");
      hide.textContent = "Hide Test Menu";
      hide.style.display = "block";
      hide.style.marginBottom = "5px";
      hide.onclick = () => {
        popup.remove();
        tmBtn.remove();
      };
      popup.appendChild(hide);

      // Close
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.style.display = "block";
      closeBtn.onclick = () => popup.remove();
      popup.appendChild(closeBtn);

      document.body.appendChild(popup);
    }
  }
})();
