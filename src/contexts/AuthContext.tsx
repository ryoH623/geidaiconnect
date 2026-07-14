// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

type Role = 'admin' | 'teacher' | 'student' | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            // メールアドレス変更（verifyBeforeUpdateEmail）は Auth 側だけ先に変わるため、
            // ログイン時に users/{uid}.email を Auth の値に追随させる
            if (
              firebaseUser.email &&
              userData.email !== firebaseUser.email
            ) {
              try {
                await updateDoc(doc(db, "users", firebaseUser.uid), {
                  email: firebaseUser.email,
                  updatedAt: serverTimestamp(),
                });
              } catch (syncError) {
                console.error("メールアドレスの同期に失敗しました", syncError);
              }
            }

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
            });
            setRole(userData.role || null);
          } else {
            // Firestore にユーザードキュメントが存在しない場合
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
            });
            setRole(null);
          }
        } catch (error) {
          console.error("ユーザー情報の取得に失敗しました", error);
          setUser(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {loading ? (
        // 認証状態の解決までの間、白画面の代わりにローディング表示を出す
        <div className="auth-loading" role="status" aria-label="読み込み中">
          <div className="auth-loading-spinner" />
          <p className="auth-loading-text">GeidaiConnect</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
