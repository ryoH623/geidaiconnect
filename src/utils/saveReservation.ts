import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface ReservationData {
  teacherId: string;
  studentId: string;
  teacherName: string;
  studentName: string;
  lessonTitle: string;
  lessonFee: number;
  lessonDate: Date; // JS Dateオブジェクト
  lessonMethod: string;
  commissionRate: number; // 0.10 または 0.15
}

export const saveReservation = async (data: ReservationData) => {
  try {
    await addDoc(collection(db, 'reservations'), {
      ...data,
      lessonDate: data.lessonDate,
      status: 'confirmed',
      createdAt: serverTimestamp(),
    });
    console.log('予約情報を保存しました');
  } catch (error) {
    console.error('予約情報の保存に失敗しました:', error);
  }
};
