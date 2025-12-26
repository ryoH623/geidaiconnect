// src/firebase.ts
import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// .env から読み込む（Viteは VITE_ プレフィクス必須）
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// HMR対策：既存インスタンスを再利用
const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Export（Register.tsx などから利用）
export const auth = getAuth(app);
export const db   = getFirestore(app);

// 任意：ログイン状態をローカルに永続化（再読み込みや再訪問に強い）
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Safariプライベート等で失敗することがあるため握りつぶし
});

export default app;
