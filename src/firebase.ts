// src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth /*, connectAuthEmulator */ } from "firebase/auth";
import { getFirestore /*, connectFirestoreEmulator */ } from "firebase/firestore";
import { getStorage /*, connectStorageEmulator */ } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Vite 環境変数（.env / .env.local などに設定）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 既存アプリがあれば再利用
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 各サービス
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ★ Cloud Functions のリージョンはデプロイに合わせて us-central1
export const functions = getFunctions(app, "us-central1");

// （任意）ローカル開発でエミュレータを使う場合は下を有効化
if (import.meta.env.DEV && location.hostname === "localhost") {
  // connectAuthEmulator(auth, "http://127.0.0.1:9099");
  // connectFirestoreEmulator(db, "127.0.0.1", 8080);
  // connectStorageEmulator(storage, "127.0.0.1", 9199);
  // connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export default app;
