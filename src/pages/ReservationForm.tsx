import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import BookingCalendar from '../components/booking/BookingCalendar';
import { teachers } from '../data/teachers';
import '../index.css';

type FormDataType = {
  name: string;
  furigana: string;
  email: string;
  phone: string;
  location: string;
  notes: string;
};

type TeacherInfo = {
  authUid: string;
  name: string;
  email?: string;
};

type CreateReservationAndCheckoutPayload = {
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
};

type CreateReservationAndCheckoutResult = {
  ok: boolean;
  reservationId: string;
  sessionId: string;
  url: string | null;
};

const ReservationForm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = getAuth();

  const queryParams = new URLSearchParams(location.search);
  const teacherIdFromQuery = decodeURIComponent(queryParams.get('teacherId') || '');
  const teacherNameFromQuery = decodeURIComponent(queryParams.get('teacher') || '');
  const lessonCourse = decodeURIComponent(queryParams.get('course') || '');
  const priceFromQuery = decodeURIComponent(queryParams.get('price') || '');
  const lessonTypeFromQuery = decodeURIComponent(queryParams.get('lessonType') || '');
  const locationDisplayFromQuery = decodeURIComponent(
    queryParams.get('locationDisplay') || ''
  );
  const noteFromQuery = decodeURIComponent(queryParams.get('note') || '');

  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [teacherLoading, setTeacherLoading] = useState(true);

  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const [formData, setFormData] = useState<FormDataType>({
    name: '',
    furigana: '',
    email: '',
    phone: '',
    location: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log('================ ReservationForm 初期表示ログ ================');
    console.log('現在のURL:', location.pathname + location.search);
    console.log('URL teacherId:', teacherIdFromQuery);
    console.log('URL teacher:', teacherNameFromQuery);
    console.log('URL course:', lessonCourse);
    console.log('URL price:', priceFromQuery);
    console.log('URL lessonType:', lessonTypeFromQuery);
    console.log('URL locationDisplay:', locationDisplayFromQuery);
    console.log('URL note:', noteFromQuery);
    console.log('現在のログインユーザー:', auth.currentUser);
    console.log('============================================================');
  }, [
    location.pathname,
    location.search,
    teacherIdFromQuery,
    teacherNameFromQuery,
    lessonCourse,
    priceFromQuery,
    lessonTypeFromQuery,
    locationDisplayFromQuery,
    noteFromQuery,
    auth,
  ]);

  useEffect(() => {
    const user = auth.currentUser;

    console.log('ReservationForm: Auth currentUser 確認:', user);

    if (!user) return;

    setFormData((prev) => ({
      ...prev,
      name: user.displayName || prev.name,
      email: user.email || prev.email,
      phone: user.phoneNumber?.replace(/[^\d]/g, '') || prev.phone,
    }));
  }, [auth]);

  useEffect(() => {
    try {
      setTeacherLoading(true);

      console.log('================ 講師情報検索ログ ================');
      console.log('検索に使う teacherIdFromQuery:', teacherIdFromQuery);
      console.log('検索に使う teacherNameFromQuery:', teacherNameFromQuery);
      console.log('teachers 件数:', teachers.length);
      console.log(
        'teachers の authUid 一覧:',
        teachers.map((t) => ({
          name: t.name,
          authUid: t.authUid,
        }))
      );

      let foundTeacher = null;

      if (teacherIdFromQuery) {
        foundTeacher = teachers.find((t) => t.authUid === teacherIdFromQuery) || null;
        console.log('teacherId で検索した結果:', foundTeacher);
      }

      if (!foundTeacher && teacherNameFromQuery) {
        foundTeacher = teachers.find((t) => t.name === teacherNameFromQuery) || null;
        console.log('teacher 名で検索した結果:', foundTeacher);
      }

      if (!foundTeacher) {
        console.warn('講師情報が見つかりませんでした。');
        setTeacherInfo(null);
        return;
      }

      const nextTeacherInfo = {
        authUid: foundTeacher.authUid,
        name: foundTeacher.name,
        email: '',
      };

      console.log('ReservationForm にセットする teacherInfo:', nextTeacherInfo);
      console.log('BookingCalendar に渡す teacherId:', nextTeacherInfo.authUid);
      console.log('=================================================');

      setTeacherInfo(nextTeacherInfo);
    } catch (error) {
      console.error('講師情報の取得に失敗しました:', error);
      setTeacherInfo(null);
    } finally {
      setTeacherLoading(false);
    }
  }, [teacherIdFromQuery, teacherNameFromQuery]);

  const selectedTeacherCourse = useMemo(() => {
    let foundTeacher = null;

    if (teacherIdFromQuery) {
      foundTeacher = teachers.find((t) => t.authUid === teacherIdFromQuery) || null;
    }
    if (!foundTeacher && teacherNameFromQuery) {
      foundTeacher = teachers.find((t) => t.name === teacherNameFromQuery) || null;
    }

    if (!foundTeacher) {
      console.warn('selectedTeacherCourse: 講師が見つからないためコース取得不可');
      return null;
    }

    const foundCourse = foundTeacher.courses.find((c) => c.title === lessonCourse) || null;

    console.log('================ コース検索ログ ================');
    console.log('対象講師:', foundTeacher.name);
    console.log('URL lessonCourse:', lessonCourse);
    console.log('講師の courses:', foundTeacher.courses);
    console.log('一致した selectedTeacherCourse:', foundCourse);
    console.log('===============================================');

    return foundCourse;
  }, [teacherIdFromQuery, teacherNameFromQuery, lessonCourse]);

  const lessonAmount = useMemo(() => {
    const priceSource = priceFromQuery || selectedTeacherCourse?.price || lessonCourse;
    const normalized = priceSource.replace(/,/g, '');
    const match = normalized.match(/(\d{3,6})\s*円?/);
    const amount = match ? Number(match[1]) : null;

    console.log('================ 料金判定ログ ================');
    console.log('priceFromQuery:', priceFromQuery);
    console.log('selectedTeacherCourse?.price:', selectedTeacherCourse?.price);
    console.log('lessonCourse:', lessonCourse);
    console.log('priceSource:', priceSource);
    console.log('判定された lessonAmount:', amount);
    console.log('=============================================');

    return amount;
  }, [priceFromQuery, selectedTeacherCourse, lessonCourse]);

  const displayLessonType = useMemo(() => {
    const value = lessonTypeFromQuery || selectedTeacherCourse?.type || '';

    console.log('displayLessonType:', value);

    return value;
  }, [lessonTypeFromQuery, selectedTeacherCourse]);

  const displayLocationHint = useMemo(() => {
    const value = locationDisplayFromQuery || selectedTeacherCourse?.locationDisplay || '';

    console.log('displayLocationHint:', value);

    return value;
  }, [locationDisplayFromQuery, selectedTeacherCourse]);

  const displayCourseNote = useMemo(() => {
    const value = noteFromQuery || selectedTeacherCourse?.note || '';

    console.log('displayCourseNote:', value);

    return value;
  }, [noteFromQuery, selectedTeacherCourse]);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.location.trim()) return prev;
      if (!displayLocationHint) return prev;

      console.log('レッスン場所に初期値をセット:', displayLocationHint);

      return {
        ...prev,
        location: displayLocationHint,
      };
    });
  }, [displayLocationHint]);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.notes.trim()) return prev;

      const autoNotes: string[] = [];
      if (displayLessonType) autoNotes.push(`レッスン種別: ${displayLessonType}`);
      if (displayCourseNote) autoNotes.push(`備考: ${displayCourseNote}`);

      if (autoNotes.length === 0) return prev;

      console.log('ご要望欄に初期メモをセット:', autoNotes);

      return {
        ...prev,
        notes: autoNotes.join('\n'),
      };
    });
  }, [displayLessonType, displayCourseNote]);

  useEffect(() => {
    console.log('================ 選択日時 state 更新ログ ================');
    console.log('selectedDate:', selectedDate);
    console.log('selectedTime:', selectedTime);
    console.log('=======================================================');
  }, [selectedDate, selectedTime]);

  const normalizeInput = (value: string): string => {
    return value.replace(/[\s　]/g, '');
  };

  const handleDateTimeSelect = (date: string, time: string) => {
    console.log('================ BookingCalendar から選択値受信 ================');
    console.log('受け取った date:', date);
    console.log('受け取った time:', time);
    console.log('現在の teacherInfo:', teacherInfo);
    console.log('現在の displayMonth:', displayMonth);
    console.log('==============================================================');

    setSelectedDate(date);
    setSelectedTime(time);

    setErrors((prev) => ({
      ...prev,
      selectedDate: '',
      selectedTime: '',
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let cleanValue = value;

    if (name === 'phone') {
      cleanValue = value.replace(/[^\d]/g, '');
    } else if (name === 'name' || name === 'furigana') {
      cleanValue = normalizeInput(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: cleanValue,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    console.log('================ validate 実行ログ ================');
    console.log('teacherInfo:', teacherInfo);
    console.log('selectedDate:', selectedDate);
    console.log('selectedTime:', selectedTime);
    console.log('lessonAmount:', lessonAmount);
    console.log('formData:', formData);
    console.log('=================================================');

    if (!teacherInfo?.authUid) {
      newErrors.teacherId = '講師情報の取得に失敗しました';
    }

    if (!selectedDate) {
      newErrors.selectedDate = 'レッスン日を選択してください';
    }

    if (!selectedTime) {
      newErrors.selectedTime = '時間を選択してください';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'お名前を入力してください';
    }

    if (!formData.furigana.trim()) {
      newErrors.furigana = 'ふりがなを入力してください';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = '正しいメールアドレスを入力してください';
    }

    const phoneRegex = /^\d{10,11}$/;
    if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = '10～11桁の電話番号を入力してください';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'レッスン場所を入力してください';
    }

    if (lessonAmount === null || !Number.isInteger(lessonAmount) || lessonAmount < 50) {
      newErrors.lessonAmount = 'レッスン料金を判定できませんでした';
    }

    console.log('validate 結果 errors:', newErrors);

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    console.log('================ 確認画面へボタン押下 ================');
    console.log('auth.currentUser:', auth.currentUser);
    console.log('teacherInfo:', teacherInfo);
    console.log('selectedDate:', selectedDate);
    console.log('selectedTime:', selectedTime);
    console.log('formData:', formData);
    console.log('====================================================');

    const user = auth.currentUser;
    if (!user) {
      alert('ログインが必要です。ログインページへ移動します。');
      navigate('/login', {
        state: { from: `${location.pathname}${location.search}` },
      });
      return;
    }

    if (!validate()) return;

    setConfirming(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToEdit = () => {
    console.log('入力画面に戻るボタン押下');
    setConfirming(false);
  };

  const handleFinalSubmit = async () => {
    const user = auth.currentUser;

    console.log('================ 最終送信ログ ================');
    console.log('auth.currentUser:', user);
    console.log('teacherInfo:', teacherInfo);
    console.log('selectedDate:', selectedDate);
    console.log('selectedTime:', selectedTime);
    console.log('lessonAmount:', lessonAmount);
    console.log('formData:', formData);
    console.log('============================================');

    if (!user) {
      alert('ログイン状態を確認できませんでした。再度ログインしてください。');
      navigate('/login', {
        state: { from: `${location.pathname}${location.search}` },
      });
      return;
    }

    if (!teacherInfo?.authUid) {
      alert('講師情報の取得に失敗しました。');
      return;
    }

    if (!validate()) {
      setConfirming(false);
      return;
    }

    try {
      setSubmitting(true);

      const functions = getFunctions(undefined, 'us-central1');
      const createReservationAndCheckout = httpsCallable<
        CreateReservationAndCheckoutPayload,
        CreateReservationAndCheckoutResult
      >(functions, 'createReservationAndCheckout');

      const payload: CreateReservationAndCheckoutPayload = {
        teacherId: teacherInfo.authUid,
        teacherName: teacherInfo.name,
        teacherEmail: teacherInfo.email || '',
        lessonCourse,
        lessonAmount: lessonAmount!,
        date: selectedDate,
        time: selectedTime,
        name: formData.name,
        furigana: formData.furigana,
        email: formData.email,
        phone: formData.phone,
        location: formData.location,
        notes: formData.notes,
      };

      console.log('Cloud Functions に送信する payload:', payload);

      const result = await createReservationAndCheckout(payload);
      const data = result.data;

      console.log('createReservationAndCheckout result:', result);
      console.log('createReservationAndCheckout data:', data);

      if (!data?.ok) {
        throw new Error('予約と決済画面の作成に失敗しました。');
      }

      if (!data.url) {
        throw new Error('Stripe Checkout のURLが取得できませんでした。');
      }

      window.location.href = data.url;
    } catch (error: any) {
      console.error('Stripe決済開始に失敗しました:', error);

      const message =
        typeof error?.message === 'string' && error.message
          ? error.message
          : '決済画面への遷移に失敗しました。';

      alert(`❌ ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (teacherLoading) {
    return (
      <main className="about-section fade-in-up">
        <h2 className="centered-heading-with-border">
          <span>レッスン予約フォーム</span>
        </h2>
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>
          講師情報を読み込み中です…
        </p>
      </main>
    );
  }

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>レッスン予約フォーム</span>
      </h2>

      {confirming ? (
        <div style={{ maxWidth: '640px', margin: '2rem auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>以下の内容でお支払いへ進みますか？</h3>

          <div className="form-group">
            <p><strong>講師名：</strong>{teacherInfo?.name}</p>
            <p><strong>レッスンコース：</strong>{lessonCourse}</p>
            {displayLessonType && <p><strong>レッスン種別：</strong>{displayLessonType}</p>}
            <p><strong>日時：</strong>{selectedDate} {selectedTime}</p>
            <p><strong>料金：</strong>{lessonAmount?.toLocaleString()}円</p>
            {displayLocationHint && (
              <p><strong>コース既定の場所：</strong>{displayLocationHint}</p>
            )}
            {displayCourseNote && (
              <p><strong>コース備考：</strong>{displayCourseNote}</p>
            )}
            <p><strong>お名前：</strong>{formData.name}</p>
            <p><strong>ふりがな：</strong>{formData.furigana}</p>
            <p><strong>メールアドレス：</strong>{formData.email}</p>
            <p><strong>電話番号：</strong>{formData.phone}</p>
            <p><strong>レッスン場所：</strong>{formData.location}</p>
            <p><strong>ご要望：</strong>{formData.notes || 'なし'}</p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              marginTop: '2rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="form-button"
              onClick={handleBackToEdit}
              disabled={submitting}
            >
              入力画面に戻る
            </button>

            <button
              type="button"
              className="form-button"
              onClick={handleFinalSubmit}
              disabled={submitting}
            >
              {submitting ? 'Stripe決済画面へ移動中…' : 'お支払いへ進む'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {teacherInfo?.authUid ? (
            <>
              {console.log('BookingCalendar 描画:', {
                teacherId: teacherInfo.authUid,
                displayMonth,
                selectedDate,
                selectedTime,
              })}

              <BookingCalendar
                teacherId={teacherInfo.authUid}
                displayMonth={displayMonth}
                onChangeMonth={(nextMonth: Date) => {
                  console.log('BookingCalendar から月変更:', nextMonth);
                  setDisplayMonth(nextMonth);
                }}
                onDateTimeSelect={handleDateTimeSelect}
              />
            </>
          ) : (
            <p style={{ textAlign: 'center', color: 'red', marginTop: '2rem' }}>
              講師情報が見つかりませんでした。講師ページから再度お試しください。
            </p>
          )}

          {(errors.selectedDate || errors.selectedTime || errors.teacherId || errors.lessonAmount) && (
            <div style={{ maxWidth: '600px', margin: '1rem auto 0' }}>
              {errors.teacherId && <p className="error">{errors.teacherId}</p>}
              {errors.selectedDate && <p className="error">{errors.selectedDate}</p>}
              {errors.selectedTime && <p className="error">{errors.selectedTime}</p>}
              {errors.lessonAmount && <p className="error">{errors.lessonAmount}</p>}
            </div>
          )}

          <form onSubmit={handleConfirm} style={{ maxWidth: '600px', margin: '2rem auto' }}>
            <div className="form-group">
              <label>講師名</label>
              <input
                type="text"
                value={teacherInfo?.name || teacherNameFromQuery || ''}
                className="form-control"
                disabled
              />
            </div>

            <div className="form-group">
              <label>レッスンコース</label>
              <input
                type="text"
                value={lessonCourse}
                className="form-control"
                disabled
              />
            </div>

            {displayLessonType && (
              <div className="form-group">
                <label>レッスン種別</label>
                <input
                  type="text"
                  value={displayLessonType}
                  className="form-control"
                  disabled
                />
              </div>
            )}

            <div className="form-group">
              <label>料金</label>
              <input
                type="text"
                value={lessonAmount ? `${lessonAmount.toLocaleString()}円` : ''}
                className="form-control"
                disabled
              />
            </div>

            {displayLocationHint && (
              <div className="form-group">
                <label>コース既定の場所</label>
                <input
                  type="text"
                  value={displayLocationHint}
                  className="form-control"
                  disabled
                />
              </div>
            )}

            {displayCourseNote && (
              <div className="form-group">
                <label>コース備考</label>
                <textarea
                  value={displayCourseNote}
                  className="form-control"
                  rows={2}
                  disabled
                />
              </div>
            )}

            <div className="form-group">
              <label>選択した日時</label>
              <input
                type="text"
                value={
                  selectedDate && selectedTime
                    ? `${selectedDate} ${selectedTime}`
                    : 'カレンダーから選択してください'
                }
                className="form-control"
                disabled
              />
            </div>

            <div className="form-group">
              <label>お名前</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-control"
                autoComplete="name"
              />
              {errors.name && <p className="error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label>ふりがな</label>
              <input
                type="text"
                name="furigana"
                value={formData.furigana}
                onChange={handleChange}
                className="form-control"
              />
              {errors.furigana && <p className="error">{errors.furigana}</p>}
            </div>

            <div className="form-group">
              <label>メールアドレス</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-control"
                autoComplete="email"
              />
              {errors.email && <p className="error">{errors.email}</p>}
            </div>

            <div className="form-group">
              <label>電話番号</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="form-control"
                autoComplete="tel"
                inputMode="numeric"
              />
              {errors.phone && <p className="error">{errors.phone}</p>}
            </div>

            <div className="form-group">
              <label>レッスン場所</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="form-control"
              />
              {errors.location && <p className="error">{errors.location}</p>}
            </div>

            <div className="form-group">
              <label>ご要望など</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="form-control"
                rows={4}
              />
            </div>

            <button type="submit" className="form-button">
              確認画面へ
            </button>
          </form>
        </>
      )}
    </main>
  );
};

export default ReservationForm;