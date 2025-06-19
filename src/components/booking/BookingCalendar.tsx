import React, { useEffect, useState } from 'react';
import "/src/index.css";

// 仮の空き状況（後でFirebaseなどと連携可能）
const mockAvailability = {
  '2025-06-13': {
    '11:00': true,
    '11:30': true,
    '12:00': false,
    '12:30': true,
  },
  '2025-06-14': {
    '11:00': false,
    '11:30': true,
    '12:00': true,
    '12:30': true,
  },
};

interface Props {
  teacherId: string;
  onDateTimeSelect: (date: string, time: string) => void;
}

const BookingCalendar: React.FC<Props> = ({ teacherId, onDateTimeSelect }) => {
  const [availability, setAvailability] = useState<any>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  useEffect(() => {
    setAvailability(mockAvailability); // 実際はAPI/Firebaseで取得
  }, [teacherId]);

  const availableDates = Object.keys(availability);
  const times = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>空き日時を選択してください</span>
      </h2>

      <div style={{ maxWidth: '600px', margin: '1rem auto' }}>
        <label>
          日付を選択：
          <select
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedTime('');
            }}
          >
            <option value="">-- 選択してください --</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </label>

        {selectedDate && (
          <div style={{ marginTop: '1rem' }}>
            <p>時間帯：</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {times.map((time) => {
                const isAvailable = availability[selectedDate]?.[time];
                const isSelected = selectedTime === time;

                return (
                  <button
                    key={time}
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedTime(time);
                      onDateTimeSelect(selectedDate, time);
                    }}
                    style={{
                      margin: '0.25rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: isAvailable
                        ? isSelected
                          ? '#a67c00'  // 選択中（ゴールド）
                          : '#6b4e19'  // 利用可能（高級茶）
                        : '#d5d5d5',   // 利用不可（グレー）
                      color: 'white',
                      border: isSelected ? '2px solid #000' : 'none',
                      borderRadius: '5px',
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      fontWeight: isSelected ? 'bold' : 'normal',
                    }}
                  >
                    {time} {isAvailable ? '◯' : '×'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default BookingCalendar;
