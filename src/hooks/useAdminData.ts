// 管理ダッシュボード各ページが使う生データ（予約・ユーザー・レビュー）を一括取得するフック。
import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import type {
  ReservationLite,
  UserLite,
  ReviewLite,
} from "../lib/adminStats";

function toMs(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export interface AdminData {
  reservations: ReservationLite[];
  users: UserLite[];
  reviews: ReviewLite[];
  loading: boolean;
  error: string;
}

export function useAdminData(): AdminData {
  const [reservations, setReservations] = useState<ReservationLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [reviews, setReviews] = useState<ReviewLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");
        const [resSnap, userSnap, reviewSnap] = await Promise.all([
          getDocs(collection(db, "reservations")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "reviews")),
        ]);
        if (!alive) return;

        setReservations(
          resSnap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              userId: str(x.userId),
              teacherId: str(x.teacherId),
              teacherName: str(x.teacherName),
              studentName: str(x.name),
              lessonCourse: str(x.lessonCourse),
              lessonAmount: num(x.lessonAmount),
              lessonDate: str(x.lessonDate),
              paymentStatus: str(x.paymentStatus),
              reservationStatus: str(x.reservationStatus),
              // 逓減制の導入前に作られた予約には無い（null → 従来の固定率で計算）
              commissionRate:
                typeof x.commissionRate === "number" ? x.commissionRate : null,
            };
          })
        );

        setUsers(
          userSnap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              displayName: str(x.displayName),
              email: str(x.email),
              role: str(x.role),
              phone: str(x.phone),
              createdAtMs: toMs(x.createdAt),
              birthday:
                x.birthday && typeof x.birthday === "object"
                  ? {
                      year: str((x.birthday as Record<string, unknown>).year),
                      month: str((x.birthday as Record<string, unknown>).month),
                      day: str((x.birthday as Record<string, unknown>).day),
                    }
                  : null,
              guardian:
                x.guardian && typeof x.guardian === "object"
                  ? {
                      name: str((x.guardian as Record<string, unknown>).name),
                      nameKana: str((x.guardian as Record<string, unknown>).nameKana),
                      relationship: str(
                        (x.guardian as Record<string, unknown>).relationship
                      ),
                      phone: str((x.guardian as Record<string, unknown>).phone),
                    }
                  : null,
            };
          })
        );

        setReviews(
          reviewSnap.docs.map((d) => {
            const x = d.data();
            return {
              teacherId: str(x.teacherId),
              rating: num(x.rating),
            };
          })
        );
      } catch (err) {
        console.error("管理データの取得に失敗しました:", err);
        if (alive) setError("データの取得に失敗しました。");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      alive = false;
    };
  }, []);

  return { reservations, users, reviews, loading, error };
}
