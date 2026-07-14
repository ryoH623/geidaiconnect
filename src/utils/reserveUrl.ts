// src/utils/reserveUrl.ts
// 予約フォーム（/reserve）へ渡すクエリの組み立て。
// トップページ（GeidaiConnectUi）と講師詳細ページ（TeacherDetail）で共用する。
import type { Teacher, LessonCourse } from "../data/teachers";

export function buildReserveUrl(teacher: Teacher, course: LessonCourse): string {
  const params = new URLSearchParams({
    teacherId: teacher.authUid,
    teacher: teacher.name,
    course: course.title,
    price: course.price,
    lessonType: course.type,
  });

  if (course.locationDisplay) {
    params.set("locationDisplay", course.locationDisplay);
  }

  if (course.note) {
    params.set("note", course.note);
  }

  return `/reserve?${params.toString()}`;
}
