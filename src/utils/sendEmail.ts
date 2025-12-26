import emailjs from '@emailjs/browser';

// 生徒用メール送信
export const sendReservationEmail = async ({
  user_name,
  email,
  lesson_date,
  teacher_name,
  lesson_location,
  lesson_fee,
}: {
  user_name: string;
  email: string;
  lesson_date: string;
  teacher_name: string;
  lesson_location: string;
  lesson_fee: string;
}) => {
  try {
    const result = await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      {
        user_name,
        email,
        lesson_date,
        teacher_name,
        lesson_location,
        lesson_fee,
      },
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
    console.log('✅ 生徒メール送信成功:', result.text);
  } catch (error) {
    console.error('❌ 生徒メール送信失敗:', error);
  }
};

// 講師用メール送信
export const sendTeacherNotificationEmail = async ({
  teacher_email,
  user_name,
  email,
  phone,
  lesson_date,
  lesson_location,
  lesson_fee,
  notes,
}: {
  teacher_email: string;
  user_name: string;
  email: string;
  phone: string;
  lesson_date: string;
  lesson_location: string;
  lesson_fee: string;
  notes: string;
}) => {
  try {
    const result = await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID_TEACHER,
      {
        teacher_email,
        user_name,
        email,
        phone,
        lesson_date,
        lesson_location,
        lesson_fee,
        notes,
      },
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
    console.log('📩 講師メール送信成功:', result.text);
  } catch (error) {
    console.error('❌ 講師メール送信失敗:', error);
  }
};
