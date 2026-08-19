// Protótipo usando Firebase Firestore modular (v9+). Substitua firebaseConfig com seu projeto.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc,
  onSnapshot, serverTimestamp, query, orderBy, where, getDocs
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
function randKey(len=20){
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s="";
  for(let i=0;i<len;i++) s+=chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}
function pathCode(){
  // If url like /d/ABC123 => return ABC123
  const p = window.location.pathname;
  const m = p.match(/^\/d\/([A-Za-z0-9_-]+)\/?$/);
  return m ? m[1] : null;
}

// DOM
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

// Default times
const defaultTimes = ["18:00","19:00","20:00","21:00"];

// Init flatpickr
flatpickr(datePicker, {altInput:true, altFormat:"d/m/Y", dateFormat:"Y-m-d", minDate:"today"});

// Auth UI helpers (if present on page)
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authUserSpan = document.getElementById("authUser");

if(loginBtn) loginBtn.addEventListener("click", ()=> signInWithPopup(auth, provider));
if(logoutBtn) logoutBtn.addEventListener("click", ()=> signOut(auth));

onAuthStateChanged(auth, user => {
  if(user){
    if(authUserSpan) authUserSpan.textContent = user.displayName || user.email;
  } else {
    if(authUserSpan) authUserSpan.textContent = "";
  }
});

// Create invite
createBtn.addEventListener("click", async () => {
  const creatorName = creatorNameEl.value.trim() || "Anônimo";
  const title = eventTitleEl.value.trim() || "";
  createBtn.disabled = true;

  // generate unique code
  let code;
  for(let i=0;i<6;i++){
    code = randChars(6);
    const docRef = doc(db, "invites", code);
    const snap = await getDoc(docRef);
    if(!snap.exists()) break;
    code = null;
  }
  if(!code){ alert("Erro ao gerar código. Tente novamente."); createBtn.disabled=false; return; }

  const key = randKey(24);
  const docRef = doc(db, "invites", code);

  const data = {
    creatorName,
    title,
    creatorKey: key,
    createdAt: serverTimestamp(),
    times: defaultTimes
  };

  // If logged in, save creatorUid for protected panel
  if(auth.currentUser){
    data.creatorUid = auth.currentUser.uid;
    data.creatorEmail = auth.currentUser.email || null;
  }

  await setDoc(docRef, data);

  currentInviteCode = code;
  creatorKey = key;
  showCreated(code, key);
  listenResponses(code);
  createBtn.disabled = false;
});

function showCreated(code, key){
  createdPanel.classList.remove("hidden");
  const link = `${window.location.origin}/d/${code}`;
  inviteLinkEl.value = link;
  dashboardKeyEl.value = key;
  // auto select times in UI
  responsesList.innerHTML = "";
}

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

// Listen to responses (dashboard)
async function listenResponses(code){
  const respCol = collection(db, "invites", code, "responses");
  const q = query(respCol, orderBy("createdAt","desc"));
  onSnapshot(q, snap => {
    responsesList.innerHTML = "";
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement("li");
      const d = data.date ? new Date(data.date).toLocaleDateString() : "";
      li.innerHTML = `<strong>${data.name || "Convidado"}</strong> — ${d} ${data.time || ""}<div class=\"muted\">${data.message||""}</div>`;
      responsesList.appendChild(li);
    });
  });
}

// Accept invite flow (for /d/:code)
async function loadInviteForAccept(code){
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
    createdAt: serverTimestamp()
  };
  await addDoc(collection(db, "invites", code, "responses"), resp);
  acceptedPanel.classList.remove("hidden");
  acceptBtn.disabled = true;
});

// On load, check path
const codeFromPath = pathCode();
if(codeFromPath){
  currentInviteCode = codeFromPath;
  loadInviteForAccept(codeFromPath);
} else {
  createSection.classList.remove(""); // default show create
}

// Optional: helper to open the protected dashboard (if logged in)
window.openDashboard = function(inviteCode){
  // If user logged in, open painel.html; otherwise fallback to non-auth flow with key
  if(auth.currentUser){
    window.location.href = `/painel.html`;
  } else {
    alert('Para acessar o painel protegido faça login (clique em Entrar) ou use a chave do painel que aparece ao criar o convite.');
  }
}
