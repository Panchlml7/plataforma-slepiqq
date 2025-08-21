// Aviso si se abre con file://
// -----------------------------------
if (location.protocol === 'file:') {
  console.warn('[Aviso] Usa un servidor local; con bundler (npm run dev).');
}

// Importar módulos desde el CDN (modular v10+)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp,
  query, orderBy, deleteDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 1. Configuración (La apiKey de Firebase NO es una credencial secreta; no poner aquí claves privadas)
// OJO: quitado el espacio que había en apiKey y corregido storageBucket (.appspot.com)
const firebaseConfig = (typeof window !== 'undefined' && window.firebaseConfig) ? window.firebaseConfig : {
  apiKey: "AIzaSyDzUGdJT-eyYjKtej63iThVLgvTHVzvxvA",
  authDomain: "ia-slep-iqq.firebaseapp.com",
  projectId: "ia-slep-iqq",
  storageBucket: "ia-slep-iqq.appspot.com",
  messagingSenderId: "528895424744",
  appId: "1:528895424744:web:7144f5e5db1bce5ffb315d"
};

// Validación simple para avisar si falta algo crítico
(function validateFirebaseConfig(cfg){
  const required = ["apiKey","authDomain","projectId","appId"];
  const missing = required.filter(k => !cfg[k] || /\s/.test(cfg[k]));
  if (missing.length) {
    console.warn("FirebaseConfig inválido. Revisa campos:", missing);
  }
})(firebaseConfig);

// Inicializar servicios
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Referencias DOM
const noteForm = document.getElementById('noteForm');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const notesList = document.getElementById('notesList');
// AÑADIDO (referencias login que faltaban)
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginGoogleBtn = document.getElementById('loginGoogleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailSpan = document.getElementById('userEmail');
const appMain = document.getElementById('appMain');
const authLoggedOut = document.getElementById('authLoggedOut');
const authLoggedIn = document.getElementById('authLoggedIn');
const statusMsg = document.getElementById('statusMsg');

// Depuración básica
function dbg(id, el){ console.log(`[DBG] ${id}:`, el ? 'OK' : 'NO'); return !!el; }
['loginForm','loginEmail','loginPassword','openRegisterCard','registerModal','registerForm','regName','regBirth','regEmail','regEst','regPassword']
  .forEach(id => dbg(id, document.getElementById(id)));

function setStatus(msg, type='info') {
  if (!statusMsg) return;
  const colors = {info:'#94a3b8', ok:'#10b981', err:'#ef4444'};
  statusMsg.textContent = msg;
  statusMsg.style.color = colors[type] || colors.info;
}

// NUEVO: crear/actualizar perfil en Firestore (sin guardar contraseña)
async function upsertUserProfile(user, opts = {}) {
  try {
    const payload = {
      uid: user.uid,
      email: user.email ?? null,
      name: opts.name ?? user.displayName ?? null,
      establishment: opts.est ?? opts.establishment ?? undefined,
      birth: opts.birth ?? undefined,
      provider: (user.providerData && user.providerData[0]?.providerId) || 'password',
      lastLoginAt: serverTimestamp()
    };
    if (opts.isNew) payload.profileCreatedAt = serverTimestamp();
    await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
  } catch (e) {
    console.warn('No se pudo guardar el perfil en Firestore:', e);
  }
}

// ['loginGoogleBtn','logoutBtn','noteForm','notesList','appMain'].forEach(id=>{
//   if (!document.getElementById(id)) console.warn('Elemento faltante en index.html:', id);
// });

// Estado de suscripción Firestore por usuario
let unsubscribeNotes = null;

// Login
loginGoogleBtn?.addEventListener('click', async () => {
  setStatus('Autenticando (popup)...');
  try {
    await signInWithPopup(auth, provider);
    setStatus('Autenticado', 'ok');
  } catch (e) {
    handleAuthError(e);
  }
});

// Logout
logoutBtn?.addEventListener('click', async () => {
  setStatus('Cerrando sesión...');
  try {
    if (unsubscribeNotes) { unsubscribeNotes(); unsubscribeNotes = null; }
    await signOut(auth);
    setStatus('Sesión cerrada','ok');
  } catch (e) {
    console.error("Error logout:", e);
    setStatus('Error al cerrar sesión','err');
  }
});

// Escuchar cambios de Auth
onAuthStateChanged(auth, user => {
  if (user) {
    // Actualiza/crea perfil en cada login (no guarda password)
    upsertUserProfile(user);
    authLoggedOut && (authLoggedOut.style.display = 'none');
    authLoggedIn && (authLoggedIn.style.display = 'block');
    appMain && (appMain.style.display = 'grid');
    if (userEmailSpan) userEmailSpan.textContent = user.email || user.uid;
    noteForm?.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    setStatus('Sesión iniciada','ok');
    subscribeUserNotes(user.uid);

    // Redirección automática a plataforma.html
    try {
      const path = location.pathname.toLowerCase();
      const inPlataforma = path.endsWith('/plataforma.html') || path.includes('plataforma.html');
      if (!inPlataforma) {
        console.log('[Auth] Sesión lista, redirigiendo a plataforma.html');
        setTimeout(() => { location.replace('plataforma.html'); }, 150);
      }
    } catch (e) { console.warn('No se pudo redirigir:', e); }
  } else {
    authLoggedOut && (authLoggedOut.style.display = 'block');
    authLoggedIn && (authLoggedIn.style.display = 'none');
    appMain && (appMain.style.display = 'none');
    if (userEmailSpan) userEmailSpan.textContent = '';
    if (notesList) notesList.innerHTML = '';
    noteForm?.querySelector('button[type="submit"]')?.setAttribute('disabled','true');
    if (unsubscribeNotes) { unsubscribeNotes(); unsubscribeNotes = null; }
    setStatus('No autenticado');
    sessionStorage.removeItem('redirPlat');
  }
});

// Suscripción notas usuario (con manejo de error)
function subscribeUserNotes(uid) {
  if (!uid) return;
  if (unsubscribeNotes) { unsubscribeNotes(); }
  const userNotesCol = collection(db, 'users', uid, 'notas');
  const q = query(userNotesCol, orderBy('createdAt', 'desc'));
  unsubscribeNotes = onSnapshot(q,
    snapshot => {
      renderNotes(snapshot.docs);
    },
    err => {
      console.error('Snapshot error:', err);
      setStatus('Error leyendo notas (revisa reglas Firestore)','err');
    }
  );
}

// 4. Escuchar formulario
noteForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) { setStatus('Debes iniciar sesión','err'); return; }
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!title || !content) return;
  try {
    setStatus('Guardando...');
    await addDoc(collection(db, 'users', user.uid, 'notas'), {
      title, content, createdAt: serverTimestamp()
    });
    noteForm.reset();
    titleInput.focus();
    setStatus('Nota guardada','ok');
  } catch (err) {
    console.error('Error al guardar:', err);
    setStatus('Error al guardar la nota','err');
  }
});

// 5. Render helper
function renderNotes(snapshotDocs) {
  if (!notesList) return;
  notesList.innerHTML = '';
  snapshotDocs.forEach(d => {
    const li = document.createElement('li');
    const data = d.data();
    li.innerHTML = `
      <div class="note-header">
        <strong>${escapeHtml(data.title || '')}</strong>
        <button data-id="${d.id}" class="delete-btn btn-sm btn-del" title="Eliminar">✕</button>
      </div>
      <p>${escapeHtml(data.content || '')}</p>
    `;
    notesList.appendChild(li);
  });
  notesList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return;
      const id = btn.getAttribute('data-id');
      if (confirm('¿Eliminar nota?')) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'notas', id));
        } catch (err) {
          console.error('Error al eliminar:', err);
          setStatus('Error al eliminar','err');
        }
      }
    });
  });
}

// 7. Utilidad para escapar HTML
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Añadir manejador de errores Auth (colocar después de setStatus / antes del listener de login)
function handleAuthError(e) {
  console.error('Auth error completo:', e);
  const code = e.code || '';
  let msg = 'Error al iniciar sesión';
  switch (code) {
    case 'auth/popup-blocked':
      msg = 'Popup bloqueado por el navegador. Reintentando con redirect...';
      setStatus(msg, 'err');
      // Fallback redirect
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js")
        .then(m => m.signInWithRedirect(auth, provider));
      return;
    case 'auth/popup-closed-by-user':
      msg = 'Cerraste la ventana antes de autenticar.';
      break;
    case 'auth/cancelled-popup-request':
      msg = 'Se canceló un popup anterior. Intenta de nuevo.';
      break;
    case 'auth/unauthorized-domain':
      msg = 'Dominio no autorizado en Firebase. Agrega localhost / 127.0.0.1 en Authentication > Settings.';
      break;
    case 'auth/network-request-failed':
      msg = 'Falla de red. Revisa conexión o bloqueadores.';
      break;
    case 'auth/internal-error':
      msg = 'Error interno. Limpia caché y vuelve a intentar.';
      break;
  }
  setStatus(`${msg} (${code})`, 'err');
  // Sugerencia adicional si no es claro
  if (code === 'auth/unauthorized-domain') {
    console.warn('Ve a Firebase Console > Authentication > Settings > Authorized domains.');
  }
}

// Referencias modal registro (solo card)
const openRegisterCard = document.getElementById('openRegisterCard');
const registerModal = document.getElementById('registerModal');
const registerForm = document.getElementById('registerForm');
const regName = document.getElementById('regName');
const regBirth = document.getElementById('regBirth');
const regEmail = document.getElementById('regEmail');
const regEst = document.getElementById('regEst');
const regPassword = document.getElementById('regPassword');

// Funciones modal (mostrar / ocultar)
function openRegisterModal() {
  if (!registerModal) { setStatus('Modal no encontrado','err'); return; }
  console.log('[DBG] Abriendo modal registro');
  registerModal.classList.remove('hidden');
  registerModal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  registerModal.offsetHeight; // reflow
  regName?.focus();
}
function closeRegisterModal() {
  if (!registerModal) return;
  registerModal.classList.add('hidden');
  registerModal.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
}

// Eventos apertura (solo card)
openRegisterCard?.addEventListener('click', () => openRegisterModal());
openRegisterCard?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openRegisterModal();
  }
});

// Eventos cierre (click fondo o botón con data-close-modal)
registerModal?.addEventListener('click', e => {
  if (e.target.matches('[data-close-modal]') || e.target === registerModal) {
    closeRegisterModal();
  }
});

// Cerrar con ESC
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !registerModal?.classList.contains('hidden')) {
    closeRegisterModal();
  }
});

// Helper: evaluar contraseña contra reglas comunes (ajusta si tu política es distinta)
function evaluatePassword(pw) {
  return {
    length: pw.length >= 8,          // muchas políticas nuevas usan 8+
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw)
  };
}
function passwordRequirementsText(res) {
  return [
    res.length ? '✓ 8+ caracteres' : '✗ 8+ caracteres',
    res.lower ? '✓ minúscula' : '✗ minúscula',
    res.upper ? '✓ mayúscula' : '✗ mayúscula',
    res.digit ? '✓ número' : '✗ número',
    res.special ? '✓ símbolo' : '✗ símbolo'
  ].join(' | ');
}
// Insertar panel de ayuda bajo el campo de password si existe
let passwordLiveHint;
const regPasswordFieldContainer = regPassword?.parentElement;
if (regPassword && regPasswordFieldContainer) {
  passwordLiveHint = document.createElement('div');
  passwordLiveHint.style.fontSize = '.65rem';
  passwordLiveHint.style.opacity = '.75';
  passwordLiveHint.style.lineHeight = '1.15rem';
  passwordLiveHint.style.userSelect = 'none';
  passwordLiveHint.id = 'passwordPolicyHint';
  regPasswordFieldContainer.appendChild(passwordLiveHint);
  const update = () => {
    const evalRes = evaluatePassword(regPassword.value);
    passwordLiveHint.textContent = passwordRequirementsText(evalRes);
  };
  regPassword.addEventListener('input', update);
  update();
}

// Extrae detalle (si Firebase expone algo en message) para password policy
function parsePasswordPolicyError(err) {
  if (!err) return '';
  // Algunos mensajes incluyen JSON o texto con 'Password should be at least...'
  const msg = err.message || '';
  const lower = msg.toLowerCase();
  if (lower.includes('at least')) return msg;
  return 'La contraseña no cumple la política definida (revisa longitud y tipos de caracteres).';
}

// Submit registro (actualizado -> usa upsertUserProfile)
registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = regName.value.trim();
  const birth = regBirth.value;
  const email = regEmail.value.trim();
  const est = regEst.value.trim();
  const pass = regPassword.value;
  if (!name || !birth || !email || !est || !pass) { setStatus('Completa todos los campos','err'); return; }
  if (pass.length < 6) { setStatus('Mínimo 6 caracteres','err'); return; }
  setStatus('Creando cuenta...');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await upsertUserProfile(cred.user, { name, birth, est, isNew: true });
    setStatus('Cuenta creada','ok');
    closeRegisterModal();
  } catch (err) {
    console.error('Registro error:', err);
    if (err.code === 'auth/operation-not-allowed') {
      setStatus('Habilita Email/Password en Firebase Console > Authentication > Sign-in method','err');
      console.warn('Ve a Firebase Console > Authentication > Sign-in method y habilita "Email/Password".');
    } else if (err.code === 'auth/email-already-in-use') {
      setStatus('Correo ya registrado. Inicia sesión.','err');
    } else if (err.code === 'auth/password-does-not-meet-requirements') {
      const evalRes = evaluatePassword(pass);
      setStatus('Contraseña inválida: ' + parsePasswordPolicyError(err),'err');
      // Refresca pista resaltando fallos
      if (passwordLiveHint) passwordLiveHint.textContent = passwordRequirementsText(evalRes);
    } else {
      setStatus('Error registro: ' + (err.code || err.message),'err');
    }
  }
});

// LOGIN email/password (actualizado -> mejora mensajes)
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const pass = loginPassword.value;
  if (!email || !pass) return;
  setStatus('Autenticando...');
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    setStatus('Login correcto','ok');
  } catch (e2) {
    console.error('Login error:', e2);
    let msg;
    switch (e2.code) {
      case 'auth/operation-not-allowed':
        msg = 'Habilita Email/Password en Firebase Console (Authentication > Sign-in method)';
        break;
      case 'auth/user-not-found':
        msg = 'Usuario no existe';
        break;
      case 'auth/wrong-password':
        msg = 'Contraseña incorrecta';
        break;
      case 'auth/invalid-email':
        msg = 'Correo inválido';
        break;
      default:
        msg = 'Error login: ' + (e2.code || e2.message);
    }
    setStatus(msg,'err');
  }
});

// Inyecta estilos mínimos para botones globales en vistas que usan app.js
(function injectGlobalButtonsStyle(){
  if (document.getElementById('globalButtonsStyle')) return;
  const css = `
  .btn, .btn-sm {
    appearance:none; display:inline-flex; align-items:center; justify-content:center; gap:.4rem;
    font-weight:700; letter-spacing:.2px; border:1px solid transparent; border-radius:12px; cursor:pointer;
    transition: transform .06s ease, box-shadow .2s ease, filter .15s ease, background .2s ease;
  }
  .btn { padding:.62rem 1rem; font-size:.95rem; }
  .btn-sm { padding:.45rem .75rem; font-size:.85rem; }
  .btn:focus-visible, .btn-sm:focus-visible { box-shadow:0 0 0 3px rgba(99,102,241,.25); outline:none; }
  .btn:hover, .btn-sm:hover { transform: translateY(-1px); }
  .btn:active, .btn-sm:active { transform: translateY(0); }
  .btn[disabled], .btn-sm[disabled] { opacity:.55; cursor:not-allowed; box-shadow:none; }
  .btn-del { background: linear-gradient(180deg, #ef4444, #dc2626); color:#fff; box-shadow:0 8px 18px -12px rgba(239,68,68,.5); }
  .btn-del:hover { filter: brightness(.98); }
  .delete-btn { line-height:1; }
  `;
  const st = document.createElement('style');
  st.id = 'globalButtonsStyle';
  st.textContent = css;
  document.head.appendChild(st);
})();