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
};

type ScheduleSlot = {
  id: string;
  teacherId: string;
  date: string;
  time: string;
  status?: string;
  isAvailable?: boolean;
  reserved?: boolean;
};

const SCHEDULES_COLLECTION = "schedules";
const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const UNAVAILABLE_STATUSES = new Set(["closed", "reserved", "booked", "pending"]);

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
  return label.slice(0, 1);
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
}: BookingCalendarProps) {
  const isReservationMode = Boolean(teacherId && onDateTimeSelect);
  const safeDisplayMonth = displayMonth ?? new Date();
  const today = new Date();

  const [reservationSlots, setReservationSlots] = useState<ScheduleSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedReservationDate, setSelectedReservationDate] = useState("");
  const [selectedReservationTime, setSelectedReservationTime] = useState("");
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

        const hasSelectedDateInCurrentMonth = items.some(
          (slot) => slot.date === selectedReservationDate
        );

        console.log("================ BookingCalendar 選択日維持判定 ================");
        console.log("現在の selectedReservationDate:", selectedReservationDate);
        console.log("hasSelectedDateInCurrentMonth:", hasSelectedDateInCurrentMonth);
        console.log("=============================================================");

        if (selectedReservationDate && !hasSelectedDateInCurrentMonth) {
          console.log(
            "選択中の日付が現在月の利用可能枠に存在しないため、選択日時をリセットします。"
          );
          setSelectedReservationDate("");
          setSelectedReservationTime("");
        }
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
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchReservationSlots();
  }, [isReservationMode, teacherId, safeDisplayMonth, selectedReservationDate]);

  const reservationAvailableDates = useMemo(() => {
    const dates = uniqueSorted(reservationSlots.map((slot) => slot.date));

    console.log("================ BookingCalendar reservationAvailableDates ================");
    console.log("reservationSlots:", reservationSlots);
    console.log("reservationAvailableDates:", dates);
    console.log("==========================================================================");

    return dates;
  }, [reservationSlots]);

  const reservationTimesForSelectedDate = useMemo(() => {
    if (!selectedReservationDate) {
      console.log("BookingCalendar: selectedReservationDate が空のため時間一覧なし");
      return [];
    }

    const times = uniqueSorted(
      reservationSlots
        .filter((slot) => slot.date === selectedReservationDate)
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
  }, [reservationSlots, selectedReservationDate]);

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
          disabled={!onChangeMonth}
        >
          前の月
        </button>

        <div className="schedule-month-title">{getMonthTitle(safeDisplayMonth)}</div>

        <button
          type="button"
          className="form-button schedule-sub-button"
          onClick={handleNextMonth}
          disabled={!onChangeMonth}
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
            ? isPast || !isCurrentMonth || !isReservationAvailable
            : isPast || !isCurrentMonth || !onToggleDate;

          const className = [
            "schedule-date-button",
            isSelected ? "is-selected" : "",
            isPast || !isCurrentMonth ? "is-past" : "",
            isToday ? "is-today" : "",
            isRegistered ? "has-registered" : "",
            isSunday ? "is-sunday" : "",
            isSaturday ? "is-saturday" : "",
            isHoliday ? "is-holiday" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={`${dateKey}-${isCurrentMonth ? "current" : "other"}`}
              type="button"
              className={className}
              disabled={isDisabled}
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

              {isRegistered && <span className="schedule-date-dot">●</span>}
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