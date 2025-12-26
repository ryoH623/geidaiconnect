import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; 
import BookingCalendar from '../components/booking/BookingCalendar';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  getDoc,
  query,
  where,
  doc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import '../index.css';
import {
  sendReservationEmail,
  sendTeacherNotificationEmail,
} from '../utils/sendEmail';

const ReservationForm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate(); 
  const queryParams = new URLSearchParams(location.search);
  const teacherName = decodeURIComponent(queryParams.get('teacher') || '');
  const lessonCourse = decodeURIComponent(queryParams.get('course') || '');

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    furigana: '',
    email: '',
    phone: '',
    location: '',
    notes: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.displayName || '',
        email: user.email || '',
        phone: user.phoneNumber?.replace(/-/g, '') || '',
      }));
    }
  }, []);

  const handleDateTimeSelect = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  };

  const normalizeInput = (value: string): string =>
    value.replace(/[\s　]/g, '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let cleanValue = value;

    if (name === 'phone') {
      cleanValue = value.replace(/-/g, '');
    } else if (name === 'name' || name === 'furigana') {
      cleanValue = normalizeInput(value);
    }

    setFormData({
      ...formData,
      [name]: cleanValue,
    });

    setErrors({ ...errors, [name]: '' });
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) newErrors.name = 'お名前を入力してください';
    if (!formData.furigana.trim()) newErrors.furigana = 'ふりがなを入力してください';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) newErrors.email = '正しいメールアドレスを入力してください';

    const phoneRegex = /^\d{10,11}$/;
    if (!phoneRegex.test(formData.phone)) newErrors.phone = '10～11桁の電話番号を入力してください';

    if (!formData.location.trim()) newErrors.location = 'レッスン場所を入力してください';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      setConfirming(true);
    } else {
      alert('ログインが必要です。ログインページへ移動します。');
      navigate('/login');
    }
  };

  const handleFinalSubmit = async () => {
    try {
      const teachersRef = collection(db, 'teachers');
      const q = query(teachersRef, where('name', '==', teacherName));
      const snapshot = await getDocs(q);

      let teacherEmail = '';
      let teacherId = '';
      let commissionRate = 0.15;

      if (!snapshot.empty) {
        const teacherDoc = snapshot.docs[0];
        const teacherData = teacherDoc.data();
        teacherEmail = teacherData.email || '';
        teacherId = teacherDoc.id;

        if (teacherId) {
          const userDocRef = doc(db, 'users', teacherId);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.createdAt?.toDate) {
              const createdAt = userData.createdAt.toDate();
              const oneYearAgo = new Date();
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
              if (createdAt <= oneYearAgo) {
                commissionRate = 0.10;
              }
            }
          }
        }
      }

      await addDoc(collection(db, 'reservations'), {
        teacherName,
        lessonCourse,
        date: selectedDate,
        time: selectedTime,
        ...formData,
        createdAt: Timestamp.now(),
        commissionRate,
      });

      await sendReservationEmail({
        user_name: formData.name,
        email: formData.email,
        lesson_date: `${selectedDate} ${selectedTime}`,
        teacher_name: teacherName,
        lesson_location: formData.location,
        lesson_fee: lessonCourse,
      });

      if (teacherEmail) {
        await sendTeacherNotificationEmail({
          teacher_email: teacherEmail,
          user_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          lesson_date: `${selectedDate} ${selectedTime}`,
          lesson_location: formData.location,
          lesson_fee: lessonCourse,
          notes: formData.notes,
        });
      }

      alert(`✅ 予約完了（手数料率 ${commissionRate * 100}%） 確認メールを送信しました。`);
      setSubmitted(true);
    } catch (error) {
      console.error('予約またはメール送信に失敗しました:', error);
      alert('❌ 予約処理またはメールの送信に失敗しました。通信環境をご確認ください。');
    }
  };

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>レッスン予約フォーム</span>
      </h2>

      {submitted ? (
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>ご予約ありがとうございました！</p>
      ) : confirming ? (
        <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
          <h3>以下の内容で予約を確定しますか？</h3>
          <p>日時: {selectedDate} {selectedTime}</p>
          <p>講師名: {teacherName}</p>
          <p>レッスンコース: {lessonCourse}</p>
          <p>お名前: {formData.name}</p>
          <p>ふりがな: {formData.furigana}</p>
          <p>メールアドレス: {formData.email}</p>
          <p>電話番号: {formData.phone}</p>
          <p>レッスン場所: {formData.location}</p>
          <p>ご要望: {formData.notes}</p>
          <button className="form-button" onClick={handleFinalSubmit}>予約を確定する</button>
        </div>
      ) : (
        <>
          <BookingCalendar teacherId="example-teacher-id" onDateTimeSelect={handleDateTimeSelect} />

          {selectedDate && selectedTime && (
            <form onSubmit={handleConfirm} style={{ maxWidth: '600px', margin: '2rem auto' }}>
              <div className="form-group">
                <label>レッスン場所</label>
                <input type="text" name="location" value={formData.location} onChange={handleChange} className="form-control" />
                {errors.location && <p className="error">{errors.location}</p>}
              </div>
              <div className="form-group">
                <label>ご要望など</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} className="form-control" />
              </div>
              <button type="submit" className="form-button">確認画面へ</button>
            </form>
          )}
        </>
      )}
    </main>
  );
};

export default ReservationForm;
