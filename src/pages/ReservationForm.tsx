import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import BookingCalendar from '../components/booking/BookingCalendar';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import '../index.css';

const ReservationForm: React.FC = () => {
  const location = useLocation();
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

  // 🔽 ログインユーザーから初期値を取得
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
    if (validate()) {
      setConfirming(true);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      await addDoc(collection(db, 'reservations'), {
        teacherName,
        lessonCourse,
        date: selectedDate,
        time: selectedTime,
        ...formData,
        createdAt: Timestamp.now(),
      });
      setSubmitted(true);
    } catch (error) {
      console.error('予約の保存に失敗しました:', error);
      alert('送信に失敗しました。再度お試しください。');
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
              <h3>選択された日時：</h3>
              <p>{selectedDate} {selectedTime}</p>

              <p><strong>講師名：</strong>{teacherName}</p>
              <p><strong>レッスンコース：</strong>{lessonCourse}</p>

              <div className="form-group">
                <label className="form-label">
                  お名前<span className="required-label">（必須）</span>
                </label>
                <input type="text" name="name" className="form-input" value={formData.name} onChange={handleChange} />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  ふりがな<span className="required-label">（必須）</span>
                </label>
                <input type="text" name="furigana" className="form-input" value={formData.furigana} onChange={handleChange} />
                {errors.furigana && <span className="form-error">{errors.furigana}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  メールアドレス<span className="required-label">（必須）</span>
                </label>
                <input type="email" name="email" className="form-input" value={formData.email} onChange={handleChange} />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  電話番号<span className="required-label">（必須）</span>
                </label>
                <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  希望レッスン場所（相談可）<span className="required-label">（必須）</span>
                </label>
                <input type="text" name="location" className="form-input" value={formData.location} onChange={handleChange} />
                {errors.location && <span className="form-error">{errors.location}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  その他のご要望<span className="optional-label">（任意）</span>
                </label>
                <textarea name="notes" className="form-textarea" rows={4} value={formData.notes} onChange={handleChange} />
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
