// ============================================================
// RHF ZERO — public/auth.js
// Firebase Google Auth — Login & Logout
// ============================================================

// Init Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDNFXLa8WGAqhLnc8RrLLTgP3nLWvXkd1w",
  authDomain: "rhf-confrims.firebaseapp.com",
  projectId: "rhf-confrims",
  storageBucket: "rhf-confrims.firebasestorage.app",
  messagingSenderId: "631231605918",
  appId: "1:631231605918:web:5a7eeeb61beeae91d65f8f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ============================================================
// LOGIN DENGAN GOOGLE
// ============================================================

async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    // Simpan ke localStorage
    localStorage.setItem('rhf_user', JSON.stringify({
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photo: user.photoURL
    }));

    // Update UI
    updateUserUI(user);
    return user;
  } catch (error) {
    console.error('Login gagal:', error.message);
    alert('Login gagal: ' + error.message);
  }
}

// ============================================================
// LOGOUT
// ============================================================

async function logout() {
  await auth.signOut();
  localStorage.removeItem('rhf_user');
  updateUserUI(null);
}

// ============================================================
// CEK STATUS LOGIN
// ============================================================

function getUser() {
  const data = localStorage.getItem('rhf_user');
  return data ? JSON.parse(data) : null;
}

function isLoggedIn() {
  return !!getUser();
}

function getUID() {
  const user = getUser();
  return user ? user.uid : ('anon_' + Date.now());
}

// ============================================================
// UPDATE UI
// ============================================================

function updateUserUI(user) {
  const loginBtn = document.getElementById('btnLogin');
  const userArea = document.getElementById('userArea');
  const userName = document.getElementById('userName');
  const userPhoto = document.getElementById('userPhoto');
  const sessionId = document.getElementById('sessionId');

  if (user) {
    // Login
    if (loginBtn) loginBtn.style.display = 'none';
    if (userArea) userArea.style.display = 'flex';
    if (userName) userName.textContent = user.displayName || user.email;
    if (userPhoto) userPhoto.src = user.photoURL || '';
    if (sessionId) sessionId.textContent = user.displayName || user.email;
  } else {
    // Logout
    if (loginBtn) loginBtn.style.display = 'block';
    if (userArea) userArea.style.display = 'none';
    if (sessionId) sessionId.textContent = 'User: ...';
  }
}

// ============================================================
// INIT: Cek status login saat halaman load
// ============================================================

auth.onAuthStateChanged((user) => {
  if (user) {
    localStorage.setItem('rhf_user', JSON.stringify({
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photo: user.photoURL
    }));
  } else {
    localStorage.removeItem('rhf_user');
  }
  updateUserUI(user);
});
