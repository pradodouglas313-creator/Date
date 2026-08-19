// Protótipo híbrido: Firebase + modo offline (localStorage) com export/import.
// O arquivo detecta a checkbox #localMode para usar armazenamento local sem backend.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc,
  onSnapshot, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiL_Ev5z6lN66x577tHkIHrAs7sjToL38",
  authDomain: "meudate-1d36d.firebaseapp.com",
  projectId: "meudate-1d36d",
  storageBucket: "meudate-1d36d.firebasestorage.app",
  messagingSenderId: "1001389537404",
  appId: "1:1001389537404:web:c073e379324992772cb1f9",
  measurementId: "G-SBVY740DT6"
};

// Init Firebase but we'll only use it when not in local mode and when available
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Utils
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

// Local storage helpers
const LS_KEY = 'meudate_invites_v1';
function loadLocalInvites(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }catch(e){ return {}; }
}
function saveLocalInvites(obj){
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}
function localInviteExists(code){
  const all = loadLocalInvites();
  return !!all[code];
}

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

const inviteHeader = document.getElementById("inviteHeader");
const datePicker = document.getElementById("datePicker");
const timesContainer = document.getElementById("timesContainer");
const customMessage = document.getElementById("customMessage");
const acceptBtn = document.getElementById("acceptBtn");
const acceptedPanel = document.getElementById("acceptedPanel");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authUserSpan = document.getElementById("authUser");

let currentInviteCode = null;
let currentInviteDoc = null; // object
let selectedTime = null;
let creatorKey = null;

// Default times
const defaultTimes = ["18:00","19:00","20:00","21:00"];

// Init flatpickr (if present)
if(window.flatpickr) flatpickr(datePicker, {altInput:true, altFormat:"d/m/Y", dateFormat:"Y-m-d", minDate:"today"});

// Auth UI helpers
if(loginBtn) loginBtn.addEventListener("click", ()=> signInWithPopup(auth, provider));
if(logoutBtn) logoutBtn.addEventListener("click", ()=> signOut(auth));

onAuthStateChanged(auth, user => {
  if(user){ if(authUserSpan) authUserSpan.textContent = user.displayName || user.email; }
  else { if(authUserSpan) authUserSpan.textContent = ""; }
});

// UI helpers
function showCreated(code, key, invite){
  createdPanel.classList.remove("hidden");
  const link = `${window.location.origin}/d/${code}`;
  inviteLinkEl.value = link;
  dashboardKeyEl.value = key;
  renderResponsesList(code);
}

function renderResponsesList(code){
  responsesList.innerHTML = '';
  if(isLocalMode() || localInviteExists(code)){
    const all = loadLocalInvites();
    const inv = all[code];
    if(!inv || !inv.responses || inv.responses.length===0){ responsesList.innerHTML = '<div class="muted">Nenhuma resposta ainda.</div>'; return; }
    inv.responses.slice().reverse().forEach(r=>{
      const li = document.createElement('li');
      const d = r.date ? new Date(r.date).toLocaleDateString() : '';
      li.innerHTML = `<strong>${r.name||'Convidado'}</strong> — ${d} ${r.time||''}<div class=\"muted\">${r.message||''}</div>`;
      responsesList.appendChild(li);
    });
    return;
  }

  // Firebase mode: listen realtime
  const respCol = collection(db, "invites", code, "responses");
  const q = query(respCol, orderBy("createdAt","desc"));
  onSnapshot(q, snap => {
    responsesList.innerHTML = '';
    if(snap.empty) { responsesList.innerHTML = '<div class="muted">Nenhuma resposta ainda.</div>'; return; }
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement('li');
      const d = data.date ? new Date(data.date).toLocaleDateString() : '';
      li.innerHTML = `<strong>${data.name || 'Convidado'}</strong> — ${d} ${data.time || ''}<div class=\"muted\">${data.message||''}</div>`;
      responsesList.appendChild(li);
    });
  });
}

function isLocalMode(){
  return localModeCheckbox && localModeCheckbox.checked;
}

// Local storage operations
function createLocalInvite(code, key, data){
  const all = loadLocalInvites();
  all[code] = data;
  if(!all[code].responses) all[code].responses = [];
  saveLocalInvites(all);
}
function addLocalResponse(code, resp){
  const all = loadLocalInvites();
  if(!all[code]) return false;
  all[code].responses = all[code].responses || [];
  all[code].responses.push(resp);
  saveLocalInvites(all);
  return true;
}

// Export/Import
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
    createLocalInvite(obj.code, obj.creatorKey || randKey(24), obj);
    currentInviteCode = obj.code;
    creatorKey = obj.creatorKey || randKey(24);
    showCreated(currentInviteCode, creatorKey, obj);
    alert('Convite importado com sucesso.');
  }catch(e){ alert('Erro ao importar o arquivo: ' + e.message); }
});

// Create invite (handles both modes)
createBtn.addEventListener("click", async () => {
  const creatorName = creatorNameEl.value.trim() || "Anônimo";
  const title = eventTitleEl.value.trim() || "";
  createBtn.disabled = true;

  // generate unique code
  let code;
  for(let i=0;i<8;i++){
    code = randChars(6);
    if(isLocalMode()){
      if(!localInviteExists(code)) break;
    } else {
      const docRef = doc(db, "invites", code);
      const snap = await getDoc(docRef);
      if(!snap.exists()) break;
      code = null;
    }
  }
  if(!code){ alert("Erro ao gerar código. Tente novamente."); createBtn.disabled=false; return; }

  const key = randKey(24);

  const data = {
    code,
    creatorName,
    title,
    creatorKey: key,
    createdAt: Date.now(),
    times: defaultTimes,
    responses: []
  };

  if(isLocalMode()){
    createLocalInvite(code, key, data);
    currentInviteCode = code;
    creatorKey = key;
    showCreated(code, key, data);
    createBtn.disabled = false;
    alert('Convite criado em modo offline. Você pode exportá-lo com "Exportar convite".');
    return;
  }

  // Firebase mode
  const docRef = doc(db, "invites", code);
  await setDoc(docRef, {
    creatorName: data.creatorName,
    title: data.title,
    creatorKey: data.creatorKey,
    createdAt: serverTimestamp(),
    times: data.times
  });
  // Save creatorUid/email if logged in
  if(auth.currentUser){
    await setDoc(docRef, { creatorUid: auth.currentUser.uid, creatorEmail: auth.currentUser.email || null }, { merge:true });
  }

  currentInviteCode = code;
  creatorKey = key;
  showCreated(code, key, data);
  listenResponses(code);
  createBtn.disabled = false;
});

// copy/share
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

// Listen to responses (for dashboard) - Firebase variant handled inside renderResponsesList via onSnapshot
async function listenResponses(code){ renderResponsesList(code); }

// Accept invite flow (for /d/:code)
async function loadInviteForAccept(code){
  // Prefer local invite if exists
  if(localInviteExists(code)){
    const all = loadLocalInvites();
    const data = all[code];
    currentInviteDoc = data;
    inviteHeader.innerHTML = `<p><strong>${data.creatorName}</strong> te convidou${data.title ? " — " + data.title : ""}</p>`;
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
    return;
  }

  // Firebase fallback
  const invRef = doc(db, "invites", code);
  const invSnap = await getDoc(invRef);
  if(!invSnap.exists()){
    inviteHeader.innerHTML = "<p>Convite não encontrado.</p>";
    return;
  }
  const data = invSnap.data();
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
}

// Accept button handler
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

  if(localInviteExists(code) || isLocalMode()){
    // local add
    const ok = addLocalResponse(code, resp);
    if(!ok) return alert('Não foi possível salvar a resposta localmente.');
    acceptedPanel.classList.remove("hidden");
    acceptBtn.disabled = true;
    return;
  }

  // Firebase add
  await addDoc(collection(db, "invites", code, "responses"), {
    ...resp,
    createdAt: serverTimestamp()
  });
  acceptedPanel.classList.remove("hidden");
  acceptBtn.disabled = true;
});

// On load, check path and whether local invite exists
const codeFromPath = pathCode();
if(codeFromPath){
  currentInviteCode = codeFromPath;
  loadInviteForAccept(codeFromPath);
} else {
  createSection.classList.remove(""); // show create section
}

// Optional: helper to open the protected dashboard (if logged in)
window.openDashboard = function(inviteCode){
  if(isLocalMode()){
    alert('Modo offline: use a chave do painel ou importe o JSON para ver respostas neste navegador.');
    return;
  }
  if(auth.currentUser){ window.location.href = `/painel.html`; }
  else { alert('Para acessar o painel protegido faça login (clique em Entrar) ou use a chave do painel que aparece ao criar o convite.'); }
}
