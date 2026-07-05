import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

const PaymentCancelPage: React.FC = () => {
  const location = useLocation();

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const teacher = decodeURIComponent(queryParams.get('teacher') || '');
  const course = decodeURIComponent(queryParams.get('course') || '');
  const reservationId = queryParams.get('reservationId') || '';
  const canceled = queryParams.get('canceled') || '1';

  const retryPath = teacher || course
    ? `/reservation?teacher=${encodeURIComponent(teacher)}&course=${encodeURIComponent(course)}`
    : '/reservation';

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>お支払いは完了していません</span>
      </h2>

      <div
        style={{
          maxWidth: '720px',
          margin: '2rem auto',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '10px',
          padding: '24px',
        }}
      >
        <p style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
          お支払いはキャンセルされました。
        </p>

        <p style={{ marginBottom: '1rem' }}>
          まだ予約は確定していません。内容を確認して、もう一度お支払いに進むことができます。
        </p>

        {(teacher || course || reservationId) && (
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            {teacher && (
              <p>
                <strong>講師名：</strong>
                {teacher}
              </p>
            )}
            {course && (
              <p>
                <strong>レッスンコース：</strong>
                {course}
              </p>
            )}
            {reservationId && (
              <p>
                <strong>予約ID：</strong>
                {reservationId}
              </p>
            )}
            <p>
              <strong>キャンセル状態：</strong>
              {canceled === '1' ? 'キャンセル済み' : canceled}
            </p>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '2rem',
          }}
        >
          <Link to={retryPath} className="form-button">
            予約画面に戻る
          </Link>

          <Link to="/" className="form-button">
            トップへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
};

export default PaymentCancelPage;