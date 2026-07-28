import { useEffect, useMemo, useState } from "react";
//import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";

type RegisteredSummaryMap = Record<
  string,
  {
    slotCount: number;
    lessonMethodLabels: string[];
  }
>;

type BookingCalendarProps = {
  // ScheduleForm 用
  displayMonth?: Date;
  selectedDates?: string[];
  registeredDates?: string[];
  registeredSummaries?: RegisteredSummaryMap;
  onChangeMonth?: React.Dispatch<React.SetStateAction<Date>> | ((date: Date) => void);
  onToggleDate?: (dateKey: string) => void;

  // ReservationForm 用
  teacherId?: string;
  onDateTimeSelect?: (date: string, time: string) => void;
  /** 下書き復元用。初回マウント時だけ選択状態の初期値として使う */
  initialSelectedDate?: string;
  initialSelectedTime?: string;
  /**
   * 予約しようとしているレッスン方法（"自宅" | "スタジオ" | "出張"）。
   * 指定した場合、講師がその方法を許可していない枠（slot.lessonMethods に含まれない枠）は
   * 予約対象外として非表示・選択不可にする。未指定なら全方法を対象にする。
   */
  requiredMethod?: string;
};

type ScheduleSlot = {
  id: string;
  teacherId: string;
  date: string;
  time: string;
  status?: string;
  isAvailable?: boolean;
  reserved?: boolean;
  /** 講師がこの枠で許可したレッスン方法（"自宅" | "スタジオ" | "出張"）。 */
  lessonMethods: string[];
};

const SCHEDULES_COLLECTION = "schedules";
const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const UNAVAILABLE_STATUSES = new Set(["closed", "reserved", "booked", "pending"]);
// 予約モードで生徒が予約できる上限（本日から何日先まで）。バックエンドの検証と一致させること。
// カードの与信は最長30日ホールドのため、締切キャプチャが間に合う30日以内に制限する。
const MAX_BOOKING_DAYS_AHEAD = 30;
// 空き枠がこの数未満なら「残りわずか（△）」として表示する
const FEW_SLOTS_THRESHOLD = 3;

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isPastDate(date: Date): boolean {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  return target < today;
}

function getMonthTitle(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getMonthRangeKeys(date: Date): { startKey: string; endKey: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
  };
}

function nthMonday(year: number, month: number, nth: number): number {
  let count = 0;

  for (let day = 1; day <= 31; day += 1) {
    const dt = new Date(year, month - 1, day);
    if (dt.getMonth() + 1 !== month) break;

    if (dt.getDay() === 1) {
      count += 1;
      if (count === nth) return day;
    }
  }

  return -1;
}

function calcShunbun(year: number): number {
  return Math.floor(
    20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
  );
}

function calcShubun(year: number): number {
  return Math.floor(
    23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
  );
}

function getHolidayName(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const key = formatDateKey(date);

  const fixedHolidayMap = new Map<string, string>([
    [`${y}-01-01`, "元日"],
    [`${y}-02-11`, "建国記念の日"],
    [`${y}-02-23`, "天皇誕生日"],
    [`${y}-04-29`, "昭和の日"],
    [`${y}-05-03`, "憲法記念日"],
    [`${y}-05-04`, "みどりの日"],
    [`${y}-05-05`, "こどもの日"],
    [`${y}-08-11`, "山の日"],
    [`${y}-11-03`, "文化の日"],
    [`${y}-11-23`, "勤労感謝の日"],
  ]);

  const fixed = fixedHolidayMap.get(key);
  if (fixed) return fixed;

  if (m === 1 && d === nthMonday(y, 1, 2)) return "成人の日";
  if (m === 7 && d === nthMonday(y, 7, 3)) return "海の日";
  if (m === 9 && d === nthMonday(y, 9, 3)) return "敬老の日";
  if (m === 10 && d === nthMonday(y, 10, 2)) return "スポーツの日";
  if (m === 3 && d === calcShunbun(y)) return "春分の日";
  if (m === 9 && d === calcShubun(y)) return "秋分の日";

  return "";
}

function buildCalendarDates(displayMonth: Date): Date[] {
  const firstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const lastDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);

  const firstWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const dates: Date[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    dates.push(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1 - (firstWeekday - i))
    );
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day));
  }

  while (dates.length % 7 !== 0) {
    const nextDay = dates.length - (firstWeekday + daysInMonth) + 1;
    dates.push(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, nextDay));
  }

  return dates;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function isSlotAvailable(slot: ScheduleSlot): boolean {
  if (slot.reserved === true) return false;
  if (slot.isAvailable === false) return false;

  const normalizedStatus = (slot.status || "").trim().toLowerCase();
  if (UNAVAILABLE_STATUSES.has(normalizedStatus)) return false;

  return true;
}

function toMethodAbbreviation(label: string): string {
  if (label === "自宅") return "自";
  if (label === "スタジオ") return "ス";
  if (label === "出張") return "出";
  if (label === "オンライン") return "オ";
  return label.slice(0, 1);
}

/** 予約カレンダーに出す空き状況マーク。null は受付対象外（記号なし） */
type AvailabilityMark = "open" | "few" | "full" | null;

const MARK_SYMBOLS: Record<Exclude<AvailabilityMark, null>, string> = {
  open: "○",
  few: "△",
  full: "×",
};

// 満席と枠未設定はどちらも生徒からは「予約できない日」なので区別しない。
// そのため文言は「満席」と断定せず「予約できません」とする。
const MARK_LABELS: Record<Exclude<AvailabilityMark, null>, string> = {
  open: "空きあり",
  few: "残りわずか",
  full: "予約できません",
};

function getAvailabilityMark(openCount: number): Exclude<AvailabilityMark, null> {
  if (openCount === 0) return "full";
  if (openCount < FEW_SLOTS_THRESHOLD) return "few";
  return "open";
}

export default function BookingCalendar({
  displayMonth,
  selectedDates = [],
  registeredDates = [],
  registeredSummaries = {},
  onChangeMonth,
  onToggleDate,
  teacherId,
  onDateTimeSelect,
  initialSelectedDate = "",
  initialSelectedTime = "",
  requiredMethod = "",
}: BookingCalendarProps) {
  const isReservationMode = Boolean(teacherId && onDateTimeSelect);
  const safeDisplayMonth = displayMonth ?? new Date();
  const today = new Date();

  // 予約しようとしている方法を講師が許可している枠かどうか。
  // requiredMethod 未指定なら常に true（従来どおり全枠対象）。
  const slotAllowsMethod = (slot: ScheduleSlot): boolean =>
    !requiredMethod ||
    (Array.isArray(slot.lessonMethods) &&
      slot.lessonMethods.includes(requiredMethod));

  // 予約モードの予約可能上限日（本日から MAX_BOOKING_DAYS_AHEAD 日先まで）
  const maxBookingDate = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + MAX_BOOKING_DAYS_AHEAD);
    return d;
  }, []);

  // 予約モードでは、現在月より前・上限日を含む月より先へは移動させない
  const displayMonthFirst = startOfDay(
    new Date(safeDisplayMonth.getFullYear(), safeDisplayMonth.getMonth(), 1)
  );
  const currentMonthFirst = startOfDay(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const nextMonthFirst = startOfDay(
    new Date(safeDisplayMonth.getFullYear(), safeDisplayMonth.getMonth() + 1, 1)
  );
  const canGoPrevMonth = !isReservationMode || displayMonthFirst > currentMonthFirst;
  const canGoNextMonth = !isReservationMode || nextMonthFirst <= maxBookingDate;

  const [reservationSlots, setReservationSlots] = useState<ScheduleSlot[]>([]);
  // 満席（枠はあるが全て埋まっている）判定と残り枠数の集計に使う、フィルタ前の全枠
  const [allReservationSlots, setAllReservationSlots] = useState<ScheduleSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedReservationDate, setSelectedReservationDate] =
    useState(initialSelectedDate);
  const [selectedReservationTime, setSelectedReservationTime] =
    useState(initialSelectedTime);
  const [reservationError, setReservationError] = useState("");

  useEffect(() => {
    console.log("================ BookingCalendar props ログ ================");
    console.log("isReservationMode:", isReservationMode);
    console.log("teacherId:", teacherId);
    console.log("displayMonth:", displayMonth);
    console.log("safeDisplayMonth:", safeDisplayMonth);
    console.log("selectedDates:", selectedDates);
    console.log("registeredDates:", registeredDates);
    console.log("onChangeMonth あり:", Boolean(onChangeMonth));
    console.log("onToggleDate あり:", Boolean(onToggleDate));
    console.log("onDateTimeSelect あり:", Boolean(onDateTimeSelect));
    console.log("===========================================================");
  }, [
    isReservationMode,
    teacherId,
    displayMonth,
    safeDisplayMonth,
    selectedDates,
    registeredDates,
    onChangeMonth,
    onToggleDate,
    onDateTimeSelect,
  ]);

  const calendarDates = useMemo(() => {
    const dates = buildCalendarDates(safeDisplayMonth);

    console.log("================ BookingCalendar カレンダー生成ログ ================");
    console.log("safeDisplayMonth:", safeDisplayMonth);
    console.log(
      "calendarDates:",
      dates.map((date) => formatDateKey(date))
    );
    console.log("=================================================================");

    return dates;
  }, [safeDisplayMonth]);

  useEffect(() => {
    if (!isReservationMode || !teacherId) {
      console.log("BookingCalendar: 予約モードではないため空き枠取得をスキップ", {
        isReservationMode,
        teacherId,
      });
      return;
    }

    const fetchReservationSlots = async () => {
      setIsLoadingSlots(true);
      setReservationError("");

      try {
        const { startKey, endKey } = getMonthRangeKeys(safeDisplayMonth);

        console.log("================ BookingCalendar 空き枠取得開始 ================");
        console.log("検索対象 collection:", SCHEDULES_COLLECTION);
        console.log("検索 teacherId:", teacherId);
        console.log("検索 startKey:", startKey);
        console.log("検索 endKey:", endKey);
        console.log("表示月 safeDisplayMonth:", safeDisplayMonth);
        console.log("=============================================================");

        const schedulesRef = collection(db, SCHEDULES_COLLECTION);

        const q = query(
          schedulesRef,
          where("teacherId", "==", teacherId)
        );

        const snapshot = await getDocs(q);

        console.log("================ BookingCalendar Firestore取得結果 ================");
        console.log("snapshot.size:", snapshot.size);
        console.log("snapshot.empty:", snapshot.empty);
        console.log(
          "raw docs:",
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
        console.log("===============================================================");

        const rawItems: ScheduleSlot[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            teacherId: typeof data.teacherId === "string" ? data.teacherId : "",
            date: typeof data.date === "string" ? data.date : "",
            time: typeof data.time === "string" ? data.time : "",
            status: typeof data.status === "string" ? data.status : "",
            isAvailable:
              typeof data.isAvailable === "boolean" ? data.isAvailable : true,
            reserved: typeof data.reserved === "boolean" ? data.reserved : false,
            lessonMethods: Array.isArray(data.lessonMethods)
              ? data.lessonMethods.filter(
                  (v): v is string => typeof v === "string"
                )
              : [],
          };
        });

        console.log("================ BookingCalendar 整形後 rawItems ================");
        console.log("rawItems 件数:", rawItems.length);
        console.log("rawItems:", rawItems);
        console.log(
          "rawItems date 一覧:",
          rawItems.map((slot) => slot.date)
        );
        console.log(
          "rawItems time 一覧:",
          rawItems.map((slot) => slot.time)
        );
        console.log(
          "rawItems availability 判定:",
          rawItems.map((slot) => ({
            id: slot.id,
            date: slot.date,
            time: slot.time,
            status: slot.status,
            isAvailable: slot.isAvailable,
            reserved: slot.reserved,
            isSlotAvailable: isSlotAvailable(slot),
          }))
        );
        console.log("==============================================================");

        const items = rawItems.filter(isSlotAvailable);

        console.log("================ BookingCalendar 利用可能枠 ================");
        console.log("items 件数:", items.length);
        console.log("items:", items);
        console.log("利用可能日付一覧:", uniqueSorted(items.map((slot) => slot.date)));
        console.log("=========================================================");

        setReservationSlots(items);
        setAllReservationSlots(rawItems);

        // 選択中の日付に空き枠が残っていなければ選択を解除する。
        // selectedReservationDate を直接読むと effect の依存に入ってしまい、
        // 日付をクリックするたびに再取得が走るため、関数型更新で現在値を参照する。
        setSelectedReservationDate((prevSelected) => {
          if (!prevSelected) return prevSelected;

          const stillAvailable = items.some((slot) => slot.date === prevSelected);

          console.log("================ BookingCalendar 選択日維持判定 ================");
          console.log("現在の selectedReservationDate:", prevSelected);
          console.log("hasSelectedDateInCurrentMonth:", stillAvailable);
          console.log("=============================================================");

          if (stillAvailable) return prevSelected;

          console.log(
            "選択中の日付が現在月の利用可能枠に存在しないため、選択日時をリセットします。"
          );
          setSelectedReservationTime("");
          return "";
        });
      } catch (error: any) {
        console.error("予約用空き枠の取得に失敗しました:", error);
        console.error("error.code:", error?.code);
        console.error("error.message:", error?.message);

        const message = String(error?.message || error || "");

        if (
          message.includes("ERR_BLOCKED_BY_CLIENT") ||
          message.includes("blocked by client")
        ) {
          setReservationError(
            "ブラウザの広告ブロック機能またはプライバシー保護機能により、空き枠情報の取得がブロックされました。広告ブロックやBrave ShieldsをOFFにして再読み込みしてください。"
          );
        } else if (
          error?.code === "permission-denied" ||
          message.includes("Missing or insufficient permissions")
        ) {
          setReservationError(
            "空き枠の取得に失敗しました。Firestore Rules の schedules 読み取り権限を確認してください。"
          );
        } else if (
          error?.code === "failed-precondition" ||
          message.includes("requires an index")
        ) {
          setReservationError(
            "空き枠の取得に失敗しました。Firestore の複合インデックスが未作成の可能性があります。"
          );
        } else {
          setReservationError(
            "空き枠の取得に失敗しました。時間をおいて再度お試しください。"
          );
        }

        setReservationSlots([]);
        setAllReservationSlots([]);
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchReservationSlots();
  }, [isReservationMode, teacherId, safeDisplayMonth]);

  const reservationAvailableDates = useMemo(() => {
    const dates = uniqueSorted(
      reservationSlots.filter(slotAllowsMethod).map((slot) => slot.date)
    );

    console.log("================ BookingCalendar reservationAvailableDates ================");
    console.log("reservationSlots:", reservationSlots);
    console.log("reservationAvailableDates:", dates);
    console.log("==========================================================================");

    return dates;
  }, [reservationSlots, requiredMethod]);

  /** 日付ごとの空き枠数／全枠数。○△× の判定に使う */
  const availabilityByDate = useMemo(() => {
    const map: Record<string, { openCount: number; totalCount: number }> = {};

    allReservationSlots.forEach((slot) => {
      if (!slot.date) return;
      // 予約方法が一致しない枠は集計対象外（○△×の判定にも数えない）
      if (!slotAllowsMethod(slot)) return;

      if (!map[slot.date]) map[slot.date] = { openCount: 0, totalCount: 0 };

      map[slot.date].totalCount += 1;
      if (isSlotAvailable(slot)) map[slot.date].openCount += 1;
    });

    console.log("================ BookingCalendar availabilityByDate ================");
    console.log("availabilityByDate:", map);
    console.log("==================================================================");

    return map;
  }, [allReservationSlots, requiredMethod]);

  const reservationTimesForSelectedDate = useMemo(() => {
    if (!selectedReservationDate) {
      console.log("BookingCalendar: selectedReservationDate が空のため時間一覧なし");
      return [];
    }

    const times = uniqueSorted(
      reservationSlots
        .filter(
          (slot) =>
            slot.date === selectedReservationDate && slotAllowsMethod(slot)
        )
        .map((slot) => slot.time)
    );

    console.log("================ BookingCalendar selectedDate の時間一覧 ================");
    console.log("selectedReservationDate:", selectedReservationDate);
    console.log(
      "対象日の slots:",
      reservationSlots.filter((slot) => slot.date === selectedReservationDate)
    );
    console.log("reservationTimesForSelectedDate:", times);
    console.log("======================================================================");

    return times;
  }, [reservationSlots, selectedReservationDate, requiredMethod]);

  const handlePrevMonth = () => {
    const prevMonth = new Date(
      safeDisplayMonth.getFullYear(),
      safeDisplayMonth.getMonth() - 1,
      1
    );

    console.log("BookingCalendar 前の月クリック:", prevMonth);

    if (onChangeMonth) {
      onChangeMonth(prevMonth);
    }
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(
      safeDisplayMonth.getFullYear(),
      safeDisplayMonth.getMonth() + 1,
      1
    );

    console.log("BookingCalendar 次の月クリック:", nextMonth);

    if (onChangeMonth) {
      onChangeMonth(nextMonth);
    }
  };

  const handleDateClick = (dateKey: string) => {
    console.log("================ BookingCalendar 日付クリック ================");
    console.log("クリック dateKey:", dateKey);
    console.log("isReservationMode:", isReservationMode);
    console.log("reservationAvailableDates:", reservationAvailableDates);
    console.log(
      "reservationAvailableDates.includes(dateKey):",
      reservationAvailableDates.includes(dateKey)
    );
    console.log("現在の selectedReservationDate:", selectedReservationDate);
    console.log("現在の selectedReservationTime:", selectedReservationTime);
    console.log("===========================================================");

    if (isReservationMode) {
      if (!reservationAvailableDates.includes(dateKey)) {
        console.warn(
          "この日付は予約可能日ではないため選択できません:",
          dateKey
        );
        return;
      }

      setSelectedReservationDate(dateKey);
      setSelectedReservationTime("");
      return;
    }

    console.log("ScheduleForm モードのため onToggleDate を呼び出します:", dateKey);
    onToggleDate?.(dateKey);
  };

  const handleTimeClick = (time: string) => {
    console.log("================ BookingCalendar 時間クリック ================");
    console.log("クリック time:", time);
    console.log("selectedReservationDate:", selectedReservationDate);
    console.log("onDateTimeSelect あり:", Boolean(onDateTimeSelect));
    console.log("===========================================================");

    if (!selectedReservationDate || !onDateTimeSelect) {
      console.warn("時間選択を親へ渡せません。", {
        selectedReservationDate,
        hasOnDateTimeSelect: Boolean(onDateTimeSelect),
      });
      return;
    }

    setSelectedReservationTime(time);

    console.log("onDateTimeSelect を呼び出します:", {
      date: selectedReservationDate,
      time,
    });

    onDateTimeSelect(selectedReservationDate, time);
  };

  useEffect(() => {
    console.log("================ BookingCalendar 選択状態 state ログ ================");
    console.log("selectedReservationDate:", selectedReservationDate);
    console.log("selectedReservationTime:", selectedReservationTime);
    console.log("reservationTimesForSelectedDate:", reservationTimesForSelectedDate);
    console.log("===================================================================");
  }, [
    selectedReservationDate,
    selectedReservationTime,
    reservationTimesForSelectedDate,
  ]);

  return (
    <div className="schedule-form-layout">
      <div className="schedule-month-nav">
        <button
          type="button"
          className="form-button schedule-sub-button"
          onClick={handlePrevMonth}
          disabled={!onChangeMonth || !canGoPrevMonth}
        >
          前の月
        </button>

        <div className="schedule-month-title">{getMonthTitle(safeDisplayMonth)}</div>

        <button
          type="button"
          className="form-button schedule-sub-button"
          onClick={handleNextMonth}
          disabled={!onChangeMonth || !canGoNextMonth}
        >
          次の月
        </button>
      </div>

      <div className="schedule-calendar-grid schedule-calendar-weekdays">
        {WEEK_LABELS.map((label, index) => {
          const weekdayClass =
            index === 0
              ? "schedule-weekday-cell is-sunday"
              : index === 6
              ? "schedule-weekday-cell is-saturday"
              : "schedule-weekday-cell";

          return (
            <div key={label} className={weekdayClass}>
              {label}
            </div>
          );
        })}
      </div>

      <div className="schedule-calendar-grid">
        {calendarDates.map((date) => {
          const dateKey = formatDateKey(date);
          const isCurrentMonth = date.getMonth() === safeDisplayMonth.getMonth();
          const isScheduleSelected = selectedDates.includes(dateKey);
          const isScheduleRegistered = registeredDates.includes(dateKey);

          const isReservationAvailable = reservationAvailableDates.includes(dateKey);
          const isReservationSelected = selectedReservationDate === dateKey;

          const isSelected = isReservationMode ? isReservationSelected : isScheduleSelected;
          const isRegistered = isReservationMode ? isReservationAvailable : isScheduleRegistered;

          const isToday = isSameDate(date, today);
          const isPast = isPastDate(date);
          // 予約モードでは上限日より先は選べない
          const isBeyondMax = isReservationMode && startOfDay(date) > maxBookingDate;
          const holidayName = getHolidayName(date);
          const isHoliday = holidayName !== "";
          const isSunday = date.getDay() === 0;
          const isSaturday = date.getDay() === 6;

          const summary = !isReservationMode ? registeredSummaries[dateKey] : undefined;
          const summaryMethodText =
            summary && summary.lessonMethodLabels.length > 0
              ? summary.lessonMethodLabels.map(toMethodAbbreviation).join("/")
              : "";

          const isDisabled = isReservationMode
            ? isPast || !isCurrentMonth || !isReservationAvailable || isBeyondMax
            : isPast || !isCurrentMonth || !onToggleDate;

          // 受付期間外（過去・他月・上限日より先）は満席ではないため記号を出さない
          const isBookingWindow =
            isReservationMode && isCurrentMonth && !isPast && !isBeyondMax;
          const mark: AvailabilityMark = isBookingWindow
            ? getAvailabilityMark(availabilityByDate[dateKey]?.openCount ?? 0)
            : null;

          const className = [
            "schedule-date-button",
            isSelected ? "is-selected" : "",
            isPast || !isCurrentMonth || isBeyondMax ? "is-past" : "",
            // 受付期間内だが予約できない日。これがないと白いセルのまま無反応になる
            mark === "full" ? "is-unavailable" : "",
            isToday ? "is-today" : "",
            isRegistered ? "has-registered" : "",
            isSunday ? "is-sunday" : "",
            isSaturday ? "is-saturday" : "",
            isHoliday ? "is-holiday" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const ariaLabel = mark
            ? `${date.getMonth() + 1}月${date.getDate()}日 ${MARK_LABELS[mark]}`
            : `${date.getMonth() + 1}月${date.getDate()}日`;

          return (
            <button
              key={`${dateKey}-${isCurrentMonth ? "current" : "other"}`}
              type="button"
              className={className}
              disabled={isDisabled}
              aria-label={isReservationMode ? ariaLabel : undefined}
              onClick={() => {
                console.log("カレンダー日付ボタン onClick 発火:", {
                  dateKey,
                  isReservationMode,
                  isCurrentMonth,
                  isPast,
                  isReservationAvailable,
                  isDisabled,
                });
                handleDateClick(dateKey);
              }}
            >
              <span className="schedule-date-number">{date.getDate()}</span>

              {isHoliday && (
                <span className="schedule-holiday-label">{holidayName}</span>
              )}

              {summary && (
                <span className="schedule-date-summary">
                  <span className="schedule-date-summary-count">{summary.slotCount}枠</span>
                  {summaryMethodText && (
                    <span className="schedule-date-summary-methods">
                      {summaryMethodText}
                    </span>
                  )}
                </span>
              )}

              {/* 予約モードは ○△×、講師モードは従来どおり ● */}
              {isReservationMode
                ? mark && (
                    <span
                      className={`schedule-date-mark is-${mark}`}
                      aria-hidden="true"
                    >
                      {MARK_SYMBOLS[mark]}
                    </span>
                  )
                : isRegistered && <span className="schedule-date-dot">●</span>}
            </button>
          );
        })}
      </div>

      {isReservationMode && (
        <div className="schedule-time-actions">
          {isLoadingSlots && (
            <p className="schedule-helper-text">空き枠を読み込み中です...</p>
          )}

          {reservationError && (
            <p className="schedule-helper-text" style={{ color: "#a33a3a" }}>
              {reservationError}
            </p>
          )}

          {!isLoadingSlots && !reservationError && (
            <>
              <ul className="schedule-legend">
                <li className="schedule-legend-item">
                  <span className="schedule-date-mark is-open" aria-hidden="true">
                    ○
                  </span>
                  空きあり
                </li>
                <li className="schedule-legend-item">
                  <span className="schedule-date-mark is-few" aria-hidden="true">
                    △
                  </span>
                  残りわずか
                </li>
                <li className="schedule-legend-item">
                  <span className="schedule-date-mark is-full" aria-hidden="true">
                    ×
                  </span>
                  予約できません
                </li>
              </ul>

              <p className="schedule-helper-text" style={{ color: "#888" }}>
                ※ ご予約は本日から約1ヶ月以内の日程で承っています。
              </p>
              <p className="schedule-helper-text">
                {selectedReservationDate
                  ? `${selectedReservationDate} の空き時間を選択してください。`
                  : "まず日付を選択してください。"}
              </p>

              {selectedReservationDate && reservationTimesForSelectedDate.length === 0 && (
                <p className="schedule-helper-text">この日の空き時間はありません。</p>
              )}

              {selectedReservationDate && reservationTimesForSelectedDate.length > 0 && (
                <div className="schedule-time-grid">
                  {reservationTimesForSelectedDate.map((time) => {
                    const isSelectedTime = selectedReservationTime === time;

                    return (
                      <button
                        key={`${selectedReservationDate}-${time}`}
                        type="button"
                        className={`schedule-time-button ${
                          isSelectedTime ? "is-selected" : ""
                        }`}
                        onClick={() => handleTimeClick(time)}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}