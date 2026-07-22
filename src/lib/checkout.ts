import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

// functions/src/index.ts の CreateReservationAndCheckoutData と一致させること
export type CreateReservationAndCheckoutData = {
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  lessonCourse: string;
  lessonAmount: number;
  date: string;
  time: string;
  name: string;
  furigana: string;
  email: string;
  phone: string;
  location: string;
  notes?: string;
  // スタジオ予約時のみ（料金はサーバ側で再計算）
  studioId?: string;
  studioName?: string;
  studioFee?: number;
};

type CreateReservationAndCheckoutResult = {
  ok: boolean;
  reservationId: string;
  sessionId: string;
  url: string | null;
};

export async function createReservationAndGoToCheckout(
  input: CreateReservationAndCheckoutData
) {
  const callable = httpsCallable<
    CreateReservationAndCheckoutData,
    CreateReservationAndCheckoutResult
  >(functions, "createReservationAndCheckout");

  const result = await callable(input);
  const url = result.data?.url;

  if (!url) {
    throw new Error("Checkout URL を取得できませんでした。");
  }

  window.location.href = url;
}