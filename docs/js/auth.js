// ============================================================
// Firebase Auth（STEP4）
// Googleログイン・ログアウト・トークン管理
// ============================================================

let _auth = null;
let _currentUser = null;

function initAuth(onUserChange) {
  firebase.initializeApp(CONFIG.FIREBASE);
  _auth = firebase.auth();

  _auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      const idToken = await firebaseUser.getIdToken();
      // GASにログイン情報を登録/更新
      try {
        const res = await apiCall('login', { idToken });
        _currentUser = res.user || null;
      } catch (e) {
        console.error('ログイン同期エラー:', e);
        _currentUser = null;
      }
    } else {
      _currentUser = null;
    }
    if (onUserChange) onUserChange(_currentUser);
  });
}

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await _auth.signInWithPopup(provider);
}

async function signOut() {
  await _auth.signOut();
  _currentUser = null;
}

async function getIdToken() {
  const user = _auth && _auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

function getCurrentUser() {
  return _currentUser;
}

function isPaidUser() {
  if (!_currentUser) return false;
  if (!_currentUser.plan || _currentUser.plan === 'free') return false;
  if (!_currentUser.expires) return false;
  return new Date(_currentUser.expires) > new Date();
}
