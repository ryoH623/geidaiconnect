import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import BookingCalendar from '../components/booking/BookingCalendar';
import { teachers } from '../data/teachers';
import { prefectures } from '../data/prefectures';
import { citiesByPrefecture } from '../data/citiesByPrefecture';
import type { AvailableStudio } from '../data/studios';
import { usePrefectureCities, useTownsWithCoords } from '../hooks/useJapaneseAddresses';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
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
  studioId?: string;
  studioName?: string;
  studioFee?: number;
};

type GetAvailableStudiosResult = {
  ok: boolean;
  studios: AvailableStudio[];
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
  const { user: authUser } = useAuth();

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

  // ご予約者情報は会員情報（users/{uid}）から自動取得する。
  // 未ログイン→予約不可、プロフィール未完（氏名/フリガナ/メール/電話が欠け）→/profileへ誘導。
  const [profileChecked, setProfileChecked] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);

  // スタジオ予約フロー用の state
  const [regionPref, setRegionPref] = useState('');
  const [regionCity, setRegionCity] = useState('');
  const [regionTown, setRegionTown] = useState('');
  const [studioSearching, setStudioSearching] = useState(false);
  const [studioResults, setStudioResults] = useState<AvailableStudio[]>([]);
  const [selectedStudio, setSelectedStudio] = useState<AvailableStudio | null>(null);
  const [studioSearchError, setStudioSearchError] = useState('');

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

  // スタジオ予約フローか（レッスン種別が「スタジオ」）
  const isStudioFlow = displayLessonType === 'スタジオ';

  // 市区町村候補は Geolonia 住所マスタ（全市区町村を網羅）から取得。
  // マスタ取得失敗時は静的リスト（citiesByPrefecture）にフォールバック
  const { data: prefCityMap } = usePrefectureCities();
  const regionCityOptions = useMemo(() => {
    if (!regionPref) return [] as string[];
    const fromGeolonia = prefCityMap?.[regionPref];
    if (fromGeolonia && fromGeolonia.length > 0) return fromGeolonia;
    const pref = prefectures.find((p) => p.name === regionPref);
    if (!pref) return [] as string[];
    return citiesByPrefecture[pref.code] || [];
  }, [regionPref, prefCityMap]);

  // 町名候補（座標つき）。町名は任意で、選ぶと「生徒から近い順」の並べ替えに使う
  const {
    towns: regionTownOptions,
    loading: regionTownsLoading,
    error: regionTownsError,
  } = useTownsWithCoords(regionPref, regionCity);

  // 合計金額（レッスン料 + スタジオ代）
  const totalAmount = useMemo(() => {
    const base = lessonAmount ?? 0;
    const studio = isStudioFlow && selectedStudio ? selectedStudio.pricePerSlot : 0;
    return base + studio;
  }, [lessonAmount, isStudioFlow, selectedStudio]);

  // 会員情報（users/{uid}）からご予約者情報（氏名・フリガナ・メール・電話）と
  // 地域の初期値を取得する。予約フォームでは再入力させず、これらを自動で使う。
  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', authUser.uid));
        if (cancelled) return;

        const d = snap.exists() ? snap.data() ?? {} : {};
        const name = `${d.lastName ?? ''}${d.firstName ?? ''}`.trim();
        const furigana = `${d.lastNameKana ?? ''}${d.firstNameKana ?? ''}`.trim();
        const email =
          typeof d.email === 'string' && d.email ? d.email : authUser.email || '';
        const phone =
          typeof d.phone === 'string' ? d.phone.replace(/[^\d]/g, '') : '';

        setFormData((prev) => ({ ...prev, name, furigana, email, phone }));

        const pref = d.prefecture;
        if (typeof pref === 'string' && pref) {
          setRegionPref((prev) => prev || pref);
        }

        // プロフィール未完のチェック（欠けている項目名を控える）
        const missing: string[] = [];
        if (!name) missing.push('お名前');
        if (!furigana) missing.push('フリガナ');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push('メールアドレス');
        if (!/^\d{10,11}$/.test(phone)) missing.push('電話番号');
        setMissingProfileFields(missing);
      } catch (error) {
        console.warn('会員情報の取得に失敗:', error);
      } finally {
        if (!cancelled) setProfileChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

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

    // 日時が変わると空き状況も変わるため、スタジオ検索結果はリセット
    setStudioResults([]);
    setSelectedStudio(null);
    setStudioSearchError('');

    setErrors((prev) => ({
      ...prev,
      selectedDate: '',
      selectedTime: '',
    }));
  };

  const handleSearchStudios = async () => {
    if (!teacherInfo?.authUid) {
      setStudioSearchError('講師情報の取得に失敗しました。');
      return;
    }
    if (!selectedDate || !selectedTime) {
      setStudioSearchError('先にカレンダーからレッスン日時を選択してください。');
      return;
    }
    if (!regionPref) {
      setStudioSearchError('地域（都道府県）を選択してください。');
      return;
    }

    setStudioSearching(true);
    setStudioSearchError('');
    setStudioResults([]);
    setSelectedStudio(null);

    try {
      const functions = getFunctions(undefined, 'us-central1');
      const getAvailableStudios = httpsCallable<
        {
          teacherId: string;
          date: string;
          time: string;
          prefecture: string;
          city?: string;
          studentLat?: number;
          studentLng?: number;
        },
        GetAvailableStudiosResult
      >(functions, 'getAvailableStudios');

      // 町名を選択済みなら代表座標を添えて「生徒から近い順」に並べ替えてもらう
      const selectedTownCoords = regionTownOptions.find(
        (t) => t.name === regionTown
      );
      const hasTownCoords =
        !!selectedTownCoords &&
        typeof selectedTownCoords.lat === 'number' &&
        typeof selectedTownCoords.lng === 'number';

      const result = await getAvailableStudios({
        teacherId: teacherInfo.authUid,
        date: selectedDate,
        time: selectedTime,
        prefecture: regionPref,
        city: regionCity || undefined,
        ...(hasTownCoords
          ? {
              studentLat: selectedTownCoords.lat as number,
              studentLng: selectedTownCoords.lng as number,
            }
          : {}),
      });

      const list = result.data?.studios ?? [];
      console.log('getAvailableStudios result:', list);
      setStudioResults(list);

      if (list.length === 0) {
        setStudioSearchError('条件に合う空きスタジオが見つかりませんでした。地域や日時を変えてお試しください。');
      }
    } catch (error: any) {
      console.error('スタジオ検索に失敗しました:', error);
      setStudioSearchError(error?.message || 'スタジオ検索に失敗しました。');
    } finally {
      setStudioSearching(false);
    }
  };

  const handleSelectStudio = (studio: AvailableStudio) => {
    setSelectedStudio(studio);
    // 予約に保存するレッスン場所をスタジオ名・住所で埋める
    const locationText = studio.address
      ? `${studio.name}（${studio.address}）`
      : studio.name;
    setFormData((prev) => ({ ...prev, location: locationText }));
    setErrors((prev) => ({ ...prev, location: '', studio: '' }));
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

    if (isStudioFlow && !selectedStudio) {
      newErrors.studio = 'スタジオを検索して選択してください';
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

    // 会員情報の読み込み前／未完のときは確認画面へ進めない
    if (!profileChecked) {
      alert('会員情報を読み込み中です。少し待ってから再度お試しください。');
      return;
    }
    if (missingProfileFields.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        ...(isStudioFlow && selectedStudio
          ? {
              studioId: selectedStudio.id,
              studioName: selectedStudio.name,
              studioFee: selectedStudio.pricePerSlot,
            }
          : {}),
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
            <p><strong>レッスン料：</strong>{lessonAmount?.toLocaleString()}円</p>
            {isStudioFlow && selectedStudio && (
              <>
                <p><strong>スタジオ：</strong>{selectedStudio.name}</p>
                <p><strong>スタジオ代：</strong>{selectedStudio.pricePerSlot.toLocaleString()}円</p>
                <p><strong>合計：</strong>{totalAmount.toLocaleString()}円</p>
              </>
            )}
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
              {isStudioFlow && selectedStudio && (
                <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
                  <p style={{ margin: '2px 0' }}>
                    スタジオ代（{selectedStudio.name}）: {selectedStudio.pricePerSlot.toLocaleString()}円
                  </p>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>
                    合計: {totalAmount.toLocaleString()}円
                  </p>
                </div>
              )}
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

            {isStudioFlow && (
              <div
                className="form-group"
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: '1rem',
                  background: '#fafafa',
                }}
              >
                <label style={{ fontWeight: 'bold' }}>スタジオを検索して選択</label>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0 0.75rem' }}>
                  ご希望の地域を選び、選択した日時に空いているスタジオを検索してください。
                  （講師が対応できるエリアのスタジオのみ表示されます）
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={regionPref}
                    onChange={(e) => {
                      setRegionPref(e.target.value);
                      setRegionCity('');
                      setRegionTown('');
                      // 地域が変わると検索結果は無効になるためリセット
                      setStudioResults([]);
                      setSelectedStudio(null);
                      setStudioSearchError('');
                    }}
                    className="form-control"
                    style={{ flex: '1 1 160px' }}
                  >
                    <option value="">都道府県を選択</option>
                    {prefectures.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={regionCity}
                    onChange={(e) => {
                      setRegionCity(e.target.value);
                      setRegionTown('');
                      setStudioResults([]);
                      setSelectedStudio(null);
                      setStudioSearchError('');
                    }}
                    className="form-control"
                    style={{ flex: '1 1 160px' }}
                    disabled={!regionPref || regionCityOptions.length === 0}
                  >
                    <option value="">市区町村（任意）</option>
                    {regionCityOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={regionTown}
                    onChange={(e) => {
                      setRegionTown(e.target.value);
                      setStudioResults([]);
                      setSelectedStudio(null);
                      setStudioSearchError('');
                    }}
                    className="form-control"
                    style={{ flex: '1 1 160px' }}
                    disabled={
                      !regionCity ||
                      regionTownsLoading ||
                      regionTownOptions.length === 0
                    }
                  >
                    <option value="">
                      {regionTownsLoading ? '町名を読込中…' : '町名（任意・近い順に表示）'}
                    </option>
                    {regionTownOptions.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {regionCity && regionTownsError && (
                  <p style={{ fontSize: '0.8rem', color: '#a66', margin: '0.25rem 0 0' }}>
                    町名候補を取得できませんでした（町名なしでも検索できます）。
                  </p>
                )}

                <button
                  type="button"
                  className="form-button"
                  onClick={handleSearchStudios}
                  disabled={studioSearching}
                  style={{ marginTop: 12 }}
                >
                  {studioSearching ? '検索中…' : '空きスタジオを検索'}
                </button>

                {studioSearchError && (
                  <p className="error" style={{ marginTop: 8 }}>
                    {studioSearchError}
                  </p>
                )}

                {studioResults.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {studioResults.map((s) => (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          border:
                            selectedStudio?.id === s.id
                              ? '2px solid #4caf7d'
                              : '1px solid #ccc',
                          borderRadius: 6,
                          padding: '0.6rem 0.8rem',
                          cursor: 'pointer',
                          background: '#fff',
                        }}
                      >
                        <input
                          type="radio"
                          name="studio"
                          checked={selectedStudio?.id === s.id}
                          onChange={() => handleSelectStudio(s)}
                          style={{ marginTop: 4 }}
                        />
                        <span>
                          <strong>{s.name}</strong>
                          {(typeof s.studentDistanceKm === 'number' ||
                            typeof s.distanceKm === 'number') && (
                            <span style={{ color: '#666', fontSize: '0.85rem' }}>
                              （
                              {typeof s.studentDistanceKm === 'number' &&
                                `選択した町から約${s.studentDistanceKm}km`}
                              {typeof s.studentDistanceKm === 'number' &&
                                typeof s.distanceKm === 'number' &&
                                '／'}
                              {typeof s.distanceKm === 'number' &&
                                `講師拠点から約${s.distanceKm}km`}
                              ）
                            </span>
                          )}
                          <br />
                          {s.address && (
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>
                              {s.address}
                              <br />
                            </span>
                          )}
                          <span>スタジオ代: {s.pricePerSlot.toLocaleString()}円</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {errors.studio && (
                  <p className="error" style={{ marginTop: 8 }}>
                    {errors.studio}
                  </p>
                )}
              </div>
            )}

            {/* ご予約者情報は会員情報から自動反映。未入力があれば会員情報の入力を促す */}
            <div
              className="form-group"
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: '1rem',
                background: '#fafafa',
              }}
            >
              <label style={{ fontWeight: 'bold' }}>ご予約者情報</label>
              {!authUser ? (
                <p style={{ margin: '0.25rem 0 0' }}>
                  ご予約にはログインが必要です。ログインすると会員情報が自動で反映されます。
                </p>
              ) : missingProfileFields.length === 0 ? (
                <>
                  <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0 0.5rem' }}>
                    会員情報から自動で反映されます。変更する場合は
                    <Link to="/profile">会員情報の編集</Link>から行ってください。
                  </p>
                  <p style={{ margin: '2px 0' }}>
                    <strong>お名前：</strong>
                    {formData.name}（{formData.furigana}）
                  </p>
                  <p style={{ margin: '2px 0' }}>
                    <strong>メール：</strong>
                    {formData.email}
                  </p>
                  <p style={{ margin: '2px 0' }}>
                    <strong>電話番号：</strong>
                    {formData.phone}
                  </p>
                </>
              ) : (
                <p className="error" style={{ margin: '0.25rem 0 0' }}>
                  会員情報に未入力の項目（{missingProfileFields.join('・')}）があります。
                  <Link to="/profile">会員情報の編集</Link>
                  から入力を完了してからご予約ください。
                </p>
              )}
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

            <button
              type="submit"
              className="form-button"
              disabled={!!authUser && (!profileChecked || missingProfileFields.length > 0)}
            >
              確認画面へ
            </button>
          </form>
        </>
      )}
    </main>
  );
};

export default ReservationForm;