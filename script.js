// MeuDate — modo 100% estático (localStorage) + export/import
(function(){
  // helpers
  function randChars(length=6){
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "";
    for(let i=0;i<length;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
    return s;
  }
  function randKey(len=24){
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let s="";
    for(let i=0;i<len;i++) s+=chars.charAt(Math.floor(Math.random()*chars.length));
    return s;
  }
  function pathCode(){
    const p = window.location.pathname;
    const m = p.match(/^\/d\/([A-Za-z0-9_-]+)\/?$/);
    return m ? m[1] : null;
  }

  // localStorage
  const LS_KEY = 'meudate_invites_v1';
  function loadLocalInvites(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }catch(e){ return {}; } }
  function saveLocalInvites(obj){ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }
  function localInviteExists(code){ const all = loadLocalInvites(); return !!all[code]; }

  // DOM
  const localModeCheckbox = document.getElementById('localMode');
  const createSection = document.getElementById("create-section");
  const acceptSection = document.getElementById("accept-section");

  const creatorNameEl = document.getElementById("creatorName");
  const eventTitleEl = document.getElementById("eventTitle");
  const createBtn = document.getElementById("createBtn");
  const createdPanel = document.getElementById("createdPanel");
  const inviteLinkEl = document.getElementById("inviteLink");
  const copyLinkBtn = document.getElementById("copyLink");
  const shareWABtn = document.getElementById("shareWA");
  const dashboardKeyEl = document.getElementById("dashboardKey");
  const responsesList = document.getElementById("responsesList");
  const exportInviteBtn = document.getElementById('exportInvite');
  const importInviteBtn = document.getElementById('importInvite');
  const importFileInput = document.getElementById('importFile');
  const inviteImageInput = document.getElementById('inviteImage');

  const inviteHeader = document.getElementById("inviteHeader");
  const datePicker = document.getElementById("datePicker");
  const timesContainer = document.getElementById("timesContainer");
  const customMessage = document.getElementById("customMessage");
  const acceptBtn = document.getElementById("acceptBtn");
  const acceptedPanel = document.getElementById("acceptedPanel");

  let currentInviteCode = null;
  let currentInviteDoc = null;
  let selectedTime = null;
  let creatorKey = null;

  const defaultTimes = ["18:00","19:00","20:00","21:00"];

  if(window.flatpickr) flatpickr(datePicker, {altInput:true, altFormat:"d/m/Y", dateFormat:"Y-m-d", minDate:"today"});

  // image helper: read as dataURL and resize to limit (maxWidth 1200)
  function fileToDataURL(file, maxWidth=1200, quality=0.8){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler imagem'));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if(w > maxWidth){
            const ratio = maxWidth / w;
            w = maxWidth; h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function showCreated(code, key){
    createdPanel.classList.remove("hidden");
    const link = `${window.location.origin}/d/${code}`;
    inviteLinkEl.value = link;
    dashboardKeyEl.value = key;
    renderResponsesList(code);
  }

  function renderResponsesList(code){
    responsesList.innerHTML = '';
    const all = loadLocalInvites();
    const inv = all[code];
    if(!inv || !inv.responses || inv.responses.length===0){
      responsesList.innerHTML = '<div class="muted">Nenhuma resposta ainda.</div>';
      return;
    }
    inv.responses.slice().reverse().forEach(r=>{
      const li = document.createElement('li');
      const d = r.date ? new Date(r.date).toLocaleDateString() : '';
      li.innerHTML = `<strong>${r.name||'Convidado'}</strong> — ${d} ${r.time||''}<div class="muted">${r.message||''}</div>`;
      responsesList.appendChild(li);
    });
  }

  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  exportInviteBtn?.addEventListener('click', ()=>{
    if(!currentInviteCode) return alert('Nenhum convite ativo para exportar.');
    const all = loadLocalInvites();
    const inv = all[currentInviteCode];
    if(!inv) return alert('Convite local não encontrado.');
    downloadJSON(inv, `meudate-invite-${currentInviteCode}.json`);
  });

  importInviteBtn?.addEventListener('click', ()=> importFileInput.click());
  importFileInput?.addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    try{
      const text = await f.text();
      const obj = JSON.parse(text);
      if(!obj.code) obj.code = randChars(6);
      const all = loadLocalInvites();
      all[obj.code] = obj;
      saveLocalInvites(all);
      currentInviteCode = obj.code;
      creatorKey = obj.creatorKey || randKey(24);
      showCreated(currentInviteCode);
      alert('Convite importado com sucesso.');
    }catch(e){ alert('Erro ao importar o arquivo: ' + e.message); }
  });

  // create invite
  createBtn.addEventListener("click", async () => {
    const creatorName = creatorNameEl.value.trim() || "Anônimo";
    const title = eventTitleEl.value.trim() || "";
    createBtn.disabled = true;

    let code;
    for(let i=0;i<8;i++){
      code = randChars(6);
      if(!localInviteExists(code)) break;
      code = null;
    }
    if(!code){ alert("Erro ao gerar código. Tente novamente."); createBtn.disabled=false; return; }

    const key = randKey(24);
    let imageData = null;
    if(inviteImageInput && inviteImageInput.files && inviteImageInput.files[0]){
      try{ imageData = await fileToDataURL(inviteImageInput.files[0], 1200, 0.75); }catch(e){ console.warn('Imagem não carregada', e); }
    }

    const data = {
      code,
      creatorName,
      title,
      creatorKey: key,
      createdAt: Date.now(),
      times: defaultTimes,
      image: imageData,
      responses: []
    };

    const all = loadLocalInvites();
    all[code] = data;
    saveLocalInvites(all);

    currentInviteCode = code;
    creatorKey = key;
    showCreated(code, key);
    createBtn.disabled = false;
    alert('Convite criado em modo offline. Você pode exportá-lo com "Exportar convite".');
  });

  copyLinkBtn.addEventListener("click", ()=> {
    inviteLinkEl.select();
    document.execCommand("copy");
    copyLinkBtn.textContent = "Copiado!";
    setTimeout(()=> copyLinkBtn.textContent = "Copiar link",1200);
  });
  shareWABtn.addEventListener("click", ()=> {
    const text = encodeURIComponent(`Tenho um convite especial para você! ${inviteLinkEl.value}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  });

  // accept invite
  function loadInviteForAccept(code){
    const all = loadLocalInvites();
    const data = all[code];
    if(!data){
      inviteHeader.innerHTML = "<p>Convite não encontrado.</p>";
      return false;
    }
    currentInviteDoc = data;
    inviteHeader.innerHTML = `<p><strong>${data.creatorName}</strong> te convidou${data.title ? " — " + data.title : ""}</p>`;
    // render times
    timesContainer.innerHTML = "";
    const times = data.times || defaultTimes;
    times.forEach(t=>{
      const b = document.createElement("button");
      b.className = "timeBtn";
      b.textContent = t;
      b.addEventListener("click", ()=> {
        document.querySelectorAll(".timeBtn").forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
        selectedTime = t;
      });
      timesContainer.appendChild(b);
    });
    acceptSection.classList.remove("hidden");
    return true;
  }

  acceptBtn.addEventListener("click", async ()=> {
    const code = currentInviteCode || pathCode();
    if(!code) return;
    const dateVal = datePicker.value;
    if(!dateVal){ alert("Escolha uma data"); return; }
    const message = customMessage.value.trim();
    const name = prompt("Seu nome (opcional):") || "Convidado";
    const resp = {
      name,
      date: dateVal,
      time: selectedTime || null,
      message,
      createdAt: Date.now()
    };

    const all = loadLocalInvites();
    if(!all[code]) return alert('Convite não encontrado localmente.');
    all[code].responses = all[code].responses || [];
    all[code].responses.push(resp);
    saveLocalInvites(all);
    acceptedPanel.classList.remove("hidden");
    acceptBtn.disabled = true;
  });

  // on load, check path
  const codeFromPath = pathCode();
  if(codeFromPath){
    currentInviteCode = codeFromPath;
    const ok = loadInviteForAccept(codeFromPath);
    if(!ok){
      // nothing
    }
  } else {
    // show create section (default)
  }

})();
