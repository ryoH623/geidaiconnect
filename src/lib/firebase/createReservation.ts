import {
  doc,
  getDoc,
  addDoc,
  collection,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import emailjs from '@emailjs/browser';

// EmailJS の設定
const serviceId = 'service_xxxxxxx';
const teacherTemplateId = 'template_xxxxxxx';
const publicKey = 'public_xxxxxxx';

// サンプル予約データ（テスト用）
const reservationData = {
  user_name: '山田 太郎',
  lesson_date: '2025年8月10日 14:00〜15:00',
  lesson_location: '東京都渋谷区 ○○スタジオ',
  lesson_fee: 6000,
  commission_rate: 15,
  commission_amount: 900,
  net_income: 5100,
  email: 'test@example.com',
  phone: '090-1234-5678',
  notes: '体験レッスン希望。オンラインも検討中。',
};

// テスト送信用の関数
export const sendTestEmail = async () => {
  console.log('送信データ（テスト）:', reservationData);

  try {
    await emailjs.send(
      serviceId,
      teacherTemplateId,
      reservationData,
      publicKey
    );
    console.log('✅ テストメール送信完了！');
  } catch (error) {
    console.error('❌ テストメール送信失敗:', error);
  }
};

// 本番予約用（以下の関数は実運用）
interface ReservationData {
  teacherId: string;
  studentId: string;
  lessonTitle: string;
  lessonDate: Date;
  lessonFee: number;
}

const createRelationshipIfNotExists = async (
  studentId: string,
  teacherId: string,
  lessonDate: Date
) => {
  const docId = `${studentId}_${teacherId}`;
  const ref = doc(db, 'relationships', docId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      studentId,
      teacherId,
      firstLessonDate: lessonDate,
      createdAt: serverTimestamp(),
    });
    console.log('📌 初回 relationship を作成しました');
  } else {
    console.log('✅ relationship は既に存在します');
  }
};

const getCommissionRateFromRelationship = async (
  studentId: string,
  teacherId: string
): Promise<number> => {
  const docId = `${studentId}_${teacherId}`;
  const ref = doc(db, 'relationships', docId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    if (data.firstLessonDate?.toDate) {
      const firstDate = data.firstLessonDate.toDate();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return firstDate <= oneYearAgo ? 0.10 : 0.15;
    }
  }

  return 0.15;
};

export const createReservation = async (data: ReservationData) => {
  const { teacherId, studentId, lessonTitle, lessonDate, lessonFee } = data;

  await createRelationshipIfNotExists(studentId, teacherId, lessonDate);

  const commissionRate = await getCommissionRateFromRelationship(studentId, teacherId);

  await addDoc(collection(db, 'reservations'), {
    teacherId,
    studentId,
    lessonTitle,
    lessonDate,
    lessonFee,
    commissionRate,
    createdAt: new Date(),
  });

  return commissionRate;
};
