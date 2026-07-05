import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
) {
  // 1) サインアップ
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // 2) 表示名が渡されたら更新
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }

  // 3) 検証メールは Functions の onCreate で自動送信されるため、
  //    フロントから sendVerifyEmail は呼ばない

  return cred.user;
}