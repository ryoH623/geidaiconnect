// src/services/userRegistration.ts
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export const registerUser = async (
  email: string,
  password: string,
  role: 'admin' | 'teacher' | 'student' = 'teacher' // デフォルトは teacher
) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;

  await setDoc(doc(db, 'users', uid), {
    email,
    role,
    createdAt: Timestamp.now(),
  });

  return uid; // 必要に応じて返す
};
