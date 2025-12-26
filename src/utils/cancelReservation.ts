import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export const cancelReservation = async (reservationId: string) => {
  const reservationRef = doc(db, "reservations", reservationId);
  await updateDoc(reservationRef, {
    status: "canceled"
  });
};
