import * as admin from "firebase-admin";
import { auth as v1auth, https, logger } from "firebase-functions/v1";
import { defineString } from "firebase-functions/params";
import nodemailer from "nodemailer";
import type { Response } from "express";

const Stripe = require("stripe");

if (!admin.apps.length) {
  admin.initializeApp();
}

// ========================================
// Environment variables
// ========================================
const SMTP_HOST = defineString("SMTP_HOST");
const SMTP_PORT = defineString("SMTP_PORT");
const SMTP_USER = defineString("SMTP_USER");
const SMTP_PASS = defineString("SMTP_PASS");
const APP_URL = defineString("APP_URL");

const STRIPE_SECRET_KEY = defineString("STRIPE_SECRET_KEY");
const STRIPE_SUCCESS_URL = defineString("STRIPE_SUCCESS_URL");
const STRIPE_CANCEL_URL = defineString("STRIPE_CANCEL_URL");
const STRIPE_WEBHOOK_SECRET = defineString("STRIPE_WEBHOOK_SECRET");

// ========================================
// SMTP / Email
// ========================================
function makeTransport() {
  const port = Number(SMTP_PORT.value());

  logger.info("makeTransport config", {
    host: SMTP_HOST.value(),
    port,
    secure: port === 465,
    user: SMTP_USER.value(),
    passExists: !!SMTP_PASS.value(),
    passLength: SMTP_PASS.value()?.length ?? 0,
  });

  return nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port,
    secure: port === 465,
    auth: {
      user: SMTP_USER.value(),
      pass: SMTP_PASS.value(),
    },
  });
}

async function verifyTransport() {
  const transporter = makeTransport();

  logger.info("SMTP config check", {
    host: SMTP_HOST.value(),
    port: SMTP_PORT.value(),
    secure: Number(SMTP_PORT.value()) === 465,
    user: SMTP_USER.value(),
    userExists: !!SMTP_USER.value(),
    passExists: !!SMTP_PASS.value(),
    userLength: SMTP_USER.value()?.length ?? 0,
    passLength: SMTP_PASS.value()?.length ?? 0,
  });

  logger.info("before transporter.verify()");
  await transporter.verify();
  logger.info("SMTP verify success");

  return transporter;
}

function buildVerifyEmailHtml(displayName: string, link: string) {
  return `
    <div style="font-family: Arial, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif; line-height: 1.8; color: #333;">
      <p>${displayName} 様</p>

      <p>Geidai Connect へのご登録ありがとうございます。</p>

      <p>
        メールアドレスの確認を完了するには、以下のボタンをクリックしてください。
      </p>

      <p style="margin: 24px 0;">
        <a
          href="${link}"
          style="
            display: inline-block;
            padding: 12px 20px;
            text-decoration: none;
            border-radius: 6px;
            background-color: #ffffff;
            color: #333333;
            border: 1px solid #cccccc;
          "
        >
          メールアドレスを確認する
        </a>
      </p>

      <p>ボタンが押せない場合は、以下のURLをブラウザに貼り付けてください。</p>
      <p style="word-break: break-all;">
        <a href="${link}">${link}</a>
      </p>

      <p>このメールに心当たりがない場合は、そのまま破棄してください。</p>

      <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;" />

      <p style="font-size: 12px; color: #666;">
        Geidai Connect<br />
        送信元: ${SMTP_USER.value()}<br />
        お問い合わせ: support@geidaiconnect.com
      </p>
    </div>
  `;
}

// ========================================
// Stripe
// ========================================
function getStripeClient() {
  const secretKey = STRIPE_SECRET_KEY.value();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY が設定されていません。");
  }

  const StripeCtor: any = Stripe;
  return new StripeCtor(secretKey);
}

// ========================================
// Types
// ========================================
type CreateCheckoutSessionData = {
  reservationId: string;
  teacherId: string;
  teacherName: string;
  courseName: string;
  amount: number;
  lessonDate: string;
  lessonTime: string;
};

type CreateCheckoutSessionResult = {
  ok: boolean;
  sessionId: string;
  url: string | null;
};

type CreateReservationAndCheckoutData = {
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

// ========================================
// Utility
// ========================================
function allowCors(req: https.Request, res: Response<any>) {
  const origin = req.get("origin") || "";

  const allowedOrigins = [
    "https://geidaiconnect.com",
    "https://www.geidaiconnect.com",
    "http://localhost:5173",
    "http://localhost:5174",
  ];

  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    res.set("Access-Control-Allow-Origin", "https://geidaiconnect.com");
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  return /^\d{10,11}$/.test(phone);
}

function buildScheduleDocId(teacherId: string, date: string, time: string): string {
  return `${teacherId}_${date}_${time.replace(":", "")}`;
}

function addMinutesToDate(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// ========================================
// Auth trigger: send verify email on sign up
// ========================================
export const sendVerifyEmail = v1auth.user().onCreate(async (user) => {
  try {
    if (!user.email) {
      logger.warn("sendVerifyEmail skipped: user has no email", {
        uid: user.uid,
      });
      return;
    }

    logger.info("sendVerifyEmail start", {
      uid: user.uid,
      email: user.email,
      appUrl: APP_URL.value(),
    });

    logger.info("before generateEmailVerificationLink");
    const link = await admin.auth().generateEmailVerificationLink(user.email, {
      url: `${APP_URL.value()}/login`,
    });

    logger.info("generateEmailVerificationLink success", {
      uid: user.uid,
      email: user.email,
    });

    const transporter = await verifyTransport();
    const displayName = user.displayName?.trim() || "ご利用者";

    logger.info("before transporter.sendMail", {
      to: user.email,
      from: SMTP_USER.value(),
    });

    await transporter.sendMail({
      from: `Geidai Connect <${SMTP_USER.value()}>`,
      to: user.email,
      replyTo: "support@geidaiconnect.com",
      subject: "【Geidai Connect】メールアドレスの確認",
      html: buildVerifyEmailHtml(displayName, link),
    });

    logger.info("sendVerifyEmail success", {
      uid: user.uid,
      email: user.email,
    });
  } catch (error) {
    logger.error("sendVerifyEmail failed", error);
    throw error;
  }
});

// ========================================
// Callable: resend verification email
// ========================================
export const resendVerifyEmail = https.onCall(async (data, context) => {
  try {
    const emailFromData =
      typeof data?.email === "string" ? data.email.trim() : "";
    const emailFromToken =
      typeof context.auth?.token?.email === "string"
        ? context.auth.token.email.trim()
        : "";

    const email = emailFromData || emailFromToken;

    if (!email) {
      throw new https.HttpsError(
        "invalid-argument",
        "メールアドレスが指定されていません。"
      );
    }

    logger.info("resendVerifyEmail start", {
      callerUid: context.auth?.uid ?? null,
      email,
      appUrl: APP_URL.value(),
    });

    const userRecord = await admin.auth().getUserByEmail(email);

    if (userRecord.emailVerified) {
      logger.info("resendVerifyEmail skipped: already verified", {
        email,
        targetUid: userRecord.uid,
      });

      return {
        ok: true,
        alreadyVerified: true,
        message: "このメールアドレスは既に確認済みです。",
      };
    }

    logger.info("before generateEmailVerificationLink (resend)", {
      email,
    });

    const link = await admin.auth().generateEmailVerificationLink(email, {
      url: `${APP_URL.value()}/login`,
    });

    logger.info("generateEmailVerificationLink success (resend)", {
      email,
      targetUid: userRecord.uid,
    });

    const transporter = await verifyTransport();
    const displayName = userRecord.displayName?.trim() || "ご利用者";

    logger.info("before transporter.sendMail (resend)", {
      to: email,
      from: SMTP_USER.value(),
    });

    await transporter.sendMail({
      from: `Geidai Connect <${SMTP_USER.value()}>`,
      to: email,
      replyTo: "support@geidaiconnect.com",
      subject: "【Geidai Connect】メールアドレスの確認（再送）",
      html: buildVerifyEmailHtml(displayName, link),
    });

    logger.info("resendVerifyEmail success", {
      email,
      targetUid: userRecord.uid,
    });

    return {
      ok: true,
      alreadyVerified: false,
      message: "確認メールを再送しました。",
    };
  } catch (error: any) {
    logger.error("resendVerifyEmail failed", error);

    if (error?.code === "auth/user-not-found") {
      throw new https.HttpsError(
        "not-found",
        "指定されたメールアドレスのユーザーが見つかりません。"
      );
    }

    if (error instanceof https.HttpsError) {
      throw error;
    }

    throw new https.HttpsError(
      "internal",
      "確認メールの再送に失敗しました。"
    );
  }
});

// ========================================
// Callable: create Stripe Checkout Session
// （テスト用として残す）
// ========================================
export const createCheckoutSession = https.onCall(
  async (
    data: CreateCheckoutSessionData,
    context
  ): Promise<CreateCheckoutSessionResult> => {
    try {
      if (!context.auth) {
        throw new https.HttpsError("unauthenticated", "ログインが必要です。");
      }

      const {
        reservationId,
        teacherId,
        teacherName,
        courseName,
        amount,
        lessonDate,
        lessonTime,
      } = data || ({} as CreateCheckoutSessionData);

      if (
        !reservationId ||
        !teacherId ||
        !teacherName ||
        !courseName ||
        !lessonDate ||
        !lessonTime
      ) {
        throw new https.HttpsError(
          "invalid-argument",
          "必要な予約情報が不足しています。"
        );
      }

      if (!Number.isInteger(amount) || amount < 50) {
        throw new https.HttpsError("invalid-argument", "金額が不正です。");
      }

      const stripe = getStripeClient();

      logger.info("createCheckoutSession start", {
        uid: context.auth.uid,
        reservationId,
        teacherId,
        amount,
        lessonDate,
        lessonTime,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card", "paypay"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "jpy",
              unit_amount: amount,
              product_data: {
                name: "Geidai Connect レッスン予約",
                description: `${teacherName} / ${courseName} / ${lessonDate} ${lessonTime}`,
              },
            },
          },
        ],
        success_url: `${STRIPE_SUCCESS_URL.value()}?session_id={CHECKOUT_SESSION_ID}&reservationId=${encodeURIComponent(
          reservationId
        )}`,
        cancel_url: `${STRIPE_CANCEL_URL.value()}?reservationId=${encodeURIComponent(
          reservationId
        )}`,
        client_reference_id: reservationId,
        customer_email:
          typeof context.auth.token.email === "string"
            ? context.auth.token.email
            : undefined,
        metadata: {
          reservationId,
          teacherId,
          teacherName,
          courseName,
          lessonDate,
          lessonTime,
          userId: context.auth.uid,
        },
      });

      logger.info("createCheckoutSession success", {
        sessionId: session.id,
        reservationId,
        urlExists: !!session.url,
      });

      return {
        ok: true,
        sessionId: session.id,
        url: session.url ?? null,
      };
    } catch (error: any) {
      logger.error("createCheckoutSession failed", error);

      if (error instanceof https.HttpsError) {
        throw error;
      }

      throw new https.HttpsError(
        "internal",
        "決済画面の作成に失敗しました。"
      );
    }
  }
);

// ========================================
// Callable: create reservation + Stripe Checkout
// 本番用
// ========================================
export const createReservationAndCheckout = https.onCall(
  async (
    data: CreateReservationAndCheckoutData,
    context
  ): Promise<CreateReservationAndCheckoutResult> => {
    let reservationRef: FirebaseFirestore.DocumentReference | null = null;

    try {
      if (!context.auth) {
        throw new https.HttpsError("unauthenticated", "ログインが必要です。");
      }

      const {
        teacherId,
        teacherName,
        teacherEmail = "",
        lessonCourse,
        lessonAmount,
        date,
        time,
        name,
        furigana,
        email,
        phone,
        location,
        notes = "",
      } = data || ({} as CreateReservationAndCheckoutData);

      if (
        !teacherId ||
        !teacherName ||
        !lessonCourse ||
        !date ||
        !time ||
        !name ||
        !furigana ||
        !email ||
        !phone ||
        !location
      ) {
        throw new https.HttpsError(
          "invalid-argument",
          "必要な予約情報が不足しています。"
        );
      }

      if (!Number.isInteger(lessonAmount) || lessonAmount < 50) {
        throw new https.HttpsError("invalid-argument", "金額が不正です。");
      }

      if (!isValidEmail(email)) {
        throw new https.HttpsError(
          "invalid-argument",
          "メールアドレスが不正です。"
        );
      }

      if (!isValidPhone(phone)) {
        throw new https.HttpsError(
          "invalid-argument",
          "電話番号が不正です。"
        );
      }

      const userId = context.auth.uid;
      const authEmail =
        typeof context.auth.token.email === "string"
          ? context.auth.token.email
          : null;

      reservationRef = admin.firestore().collection("reservations").doc();
      const reservationId = reservationRef.id;

      const scheduleDocId = buildScheduleDocId(teacherId, date, time);
      const scheduleRef = admin.firestore().collection("schedules").doc(scheduleDocId);

      logger.info("createReservationAndCheckout start", {
        uid: userId,
        reservationId,
        teacherId,
        lessonAmount,
        date,
        time,
        scheduleDocId,
      });

      await admin.firestore().runTransaction(async (tx) => {
        const scheduleSnap = await tx.get(scheduleRef);

        if (!scheduleSnap.exists) {
          throw new https.HttpsError(
            "not-found",
            "選択した時間枠が見つかりませんでした。"
          );
        }

        const schedule = scheduleSnap.data() || {};
        const currentStatus = String(schedule.status || "open").toLowerCase();
        const currentIsAvailable =
          typeof schedule.isAvailable === "boolean"
            ? schedule.isAvailable
            : true;

        const unavailableStatuses = new Set([
          "closed",
          "reserved",
          "booked",
          "pending",
        ]);

        if (!currentIsAvailable || unavailableStatuses.has(currentStatus)) {
          throw new https.HttpsError(
            "already-exists",
            "この時間枠はすでに予約済み、または受付停止です。"
          );
        }

        tx.update(scheduleRef, {
          status: "pending",
          isAvailable: false,
          pendingReservationId: reservationId,
          pendingUserId: userId,
          pendingExpiresAt: admin.firestore.Timestamp.fromDate(
            addMinutesToDate(new Date(), 30)
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(reservationRef!, {
          reservationId,
          userId,
          userEmail: authEmail ?? email,
          teacherId,
          teacherName,
          teacherEmail,
          lessonCourse,
          lessonAmount,
          lessonDate: date,
          lessonTime: time,
          scheduleDocId,
          name,
          furigana,
          email,
          phone,
          location,
          notes,
          paymentStatus: "pending_payment",
          reservationStatus: "pending",
          paymentProvider: "stripe",
          stripeSessionId: null,
          stripePaymentIntentId: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAt: null,
        });
      });

      const stripe = getStripeClient();

      const cancelUrl =
        `${STRIPE_CANCEL_URL.value()}?teacher=${encodeURIComponent(
          teacherName
        )}` +
        `&course=${encodeURIComponent(lessonCourse)}` +
        `&reservationId=${encodeURIComponent(reservationId)}` +
        `&canceled=1`;

      const successUrl =
        `${STRIPE_SUCCESS_URL.value()}?session_id={CHECKOUT_SESSION_ID}` +
        `&reservationId=${encodeURIComponent(reservationId)}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card", "paypay"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "jpy",
              unit_amount: lessonAmount,
              product_data: {
                name: "Geidai Connect レッスン予約",
                description: `${teacherName} / ${lessonCourse} / ${date} ${time}`,
              },
            },
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: reservationId,
        customer_email: email || authEmail || undefined,
        metadata: {
          reservationId,
          scheduleDocId,
          teacherId,
          teacherName,
          lessonCourse,
          lessonDate: date,
          lessonTime: time,
          userId,
          studentName: name,
          studentEmail: email,
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      });

      await reservationRef.set(
        {
          stripeSessionId: session.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("createReservationAndCheckout success", {
        reservationId,
        sessionId: session.id,
        successUrl,
        cancelUrl,
        urlExists: !!session.url,
      });

      return {
        ok: true,
        reservationId,
        sessionId: session.id,
        url: session.url ?? null,
      };
    } catch (error: any) {
      logger.error("createReservationAndCheckout failed", error);

      if (reservationRef) {
        try {
          const reservationSnap = await reservationRef.get();
          const reservationData = reservationSnap.exists ? reservationSnap.data() : null;
          const scheduleDocId = reservationData?.scheduleDocId;

          if (scheduleDocId) {
            const scheduleRef = admin.firestore().collection("schedules").doc(scheduleDocId);
            await admin.firestore().runTransaction(async (tx) => {
              const scheduleSnap = await tx.get(scheduleRef);
              if (scheduleSnap.exists) {
                const schedule = scheduleSnap.data() || {};
                if (schedule.pendingReservationId === reservationRef!.id) {
                  tx.update(scheduleRef, {
                    status: "open",
                    isAvailable: true,
                    pendingReservationId: admin.firestore.FieldValue.delete(),
                    pendingUserId: admin.firestore.FieldValue.delete(),
                    pendingExpiresAt: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                }
              }

              tx.delete(reservationRef!);
            });
          } else {
            await reservationRef.delete();
          }

          logger.info("createReservationAndCheckout rollback success", {
            reservationId: reservationRef.id,
          });
        } catch (rollbackError) {
          logger.error(
            "createReservationAndCheckout rollback failed",
            rollbackError
          );
        }
      }

      if (error instanceof https.HttpsError) {
        throw error;
      }

      throw new https.HttpsError(
        "internal",
        "予約と決済画面の作成に失敗しました。"
      );
    }
  }
);

// ========================================
// HTTP: get reservation for success page
// reservationId または session_id で取得可能
// ========================================
export const getReservationForSuccess = https.onRequest(async (req, res) => {
  try {
    allowCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, message: "Method Not Allowed" });
      return;
    }

    const authHeader = req.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : "";

    if (!idToken) {
      res.status(401).json({ ok: false, message: "ログインが必要です。" });
      return;
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const reservationId =
      typeof req.body?.reservationId === "string"
        ? req.body.reservationId.trim()
        : "";

    const sessionId =
      typeof req.body?.sessionId === "string"
        ? req.body.sessionId.trim()
        : typeof req.body?.session_id === "string"
        ? req.body.session_id.trim()
        : "";

    let snap: FirebaseFirestore.DocumentSnapshot | null = null;

    if (reservationId) {
      snap = await admin
        .firestore()
        .collection("reservations")
        .doc(reservationId)
        .get();
    } else if (sessionId) {
      const qs = await admin
        .firestore()
        .collection("reservations")
        .where("stripeSessionId", "==", sessionId)
        .limit(1)
        .get();

      if (!qs.empty) {
        snap = qs.docs[0];
      }
    } else {
      res.status(400).json({
        ok: false,
        message: "reservationId または sessionId が必要です。",
      });
      return;
    }

    if (!snap || !snap.exists) {
      res.status(404).json({
        ok: false,
        message: "予約情報が見つかりませんでした。",
      });
      return;
    }

    const reservation = snap.data() as any;

    if (reservation.userId !== uid) {
      res.status(403).json({
        ok: false,
        message: "この予約情報を表示する権限がありません。",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      reservationId: snap.id,
      reservation: {
        teacherId: reservation.teacherId ?? "",
        teacherName: reservation.teacherName ?? "",
        teacherEmail: reservation.teacherEmail ?? "",
        lessonCourse: reservation.lessonCourse ?? "",
        lessonAmount: reservation.lessonAmount ?? 0,
        lessonDate: reservation.lessonDate ?? "",
        lessonTime: reservation.lessonTime ?? "",
        name: reservation.name ?? "",
        furigana: reservation.furigana ?? "",
        email: reservation.email ?? "",
        phone: reservation.phone ?? "",
        location: reservation.location ?? "",
        notes: reservation.notes ?? "",
        paymentStatus: reservation.paymentStatus ?? "",
        reservationStatus: reservation.reservationStatus ?? "",
        paymentProvider: reservation.paymentProvider ?? "",
        userEmail: reservation.userEmail ?? "",
        scheduleDocId: reservation.scheduleDocId ?? "",
      },
    });
  } catch (error: any) {
    logger.error("getReservationForSuccess failed", error);
    res.status(500).json({
      ok: false,
      message: error?.message ?? "予約情報の取得に失敗しました。",
    });
  }
});

// ========================================
// HTTP: Stripe Webhook
// ========================================
export const stripeWebhook = https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const signature = req.get("Stripe-Signature");
    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();

    if (!signature) {
      logger.error("stripeWebhook: missing Stripe-Signature header");
      res.status(400).send("Missing signature");
      return;
    }

    if (!webhookSecret) {
      logger.error("stripeWebhook: STRIPE_WEBHOOK_SECRET is not set");
      res.status(500).send("Webhook secret is not configured");
      return;
    }

    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      signature,
      webhookSecret
    );

    logger.info("stripeWebhook received", {
      type: event.type,
      id: event.id,
    });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;

      const reservationId =
        typeof session.client_reference_id === "string"
          ? session.client_reference_id
          : session.metadata?.reservationId;

      const scheduleDocId =
        typeof session.metadata?.scheduleDocId === "string"
          ? session.metadata.scheduleDocId
          : "";

      if (!reservationId) {
        logger.error("stripeWebhook: reservationId not found", {
          sessionId: session.id,
        });
        res.status(400).send("reservationId not found");
        return;
      }

      const reservationRef = admin
        .firestore()
        .collection("reservations")
        .doc(reservationId);

      await admin.firestore().runTransaction(async (tx) => {
        tx.set(
          reservationRef,
          {
            paymentStatus: "paid",
            reservationStatus: "confirmed",
            paymentProvider: "stripe",
            stripeSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (scheduleDocId) {
          const scheduleRef = admin.firestore().collection("schedules").doc(scheduleDocId);

          tx.set(
            scheduleRef,
            {
              status: "reserved",
              isAvailable: false,
              reservationId,
              reservedAt: admin.firestore.FieldValue.serverTimestamp(),
              pendingReservationId: admin.firestore.FieldValue.delete(),
              pendingUserId: admin.firestore.FieldValue.delete(),
              pendingExpiresAt: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      });

      logger.info("stripeWebhook: reservation marked as paid", {
        reservationId,
        sessionId: session.id,
        scheduleDocId,
      });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as any;

      const reservationId =
        typeof session.client_reference_id === "string"
          ? session.client_reference_id
          : session.metadata?.reservationId;

      const scheduleDocId =
        typeof session.metadata?.scheduleDocId === "string"
          ? session.metadata.scheduleDocId
          : "";

      if (reservationId) {
        const reservationRef = admin
          .firestore()
          .collection("reservations")
          .doc(reservationId);

        await admin.firestore().runTransaction(async (tx) => {
          // Firestore のトランザクションは「読み取り→書き込み」の順序必須のため、
          // schedules の読み取りを先に行う
          let scheduleRef: FirebaseFirestore.DocumentReference | null = null;
          let shouldReopenSchedule = false;

          if (scheduleDocId) {
            scheduleRef = admin.firestore().collection("schedules").doc(scheduleDocId);
            const scheduleSnap = await tx.get(scheduleRef);

            if (scheduleSnap.exists) {
              const schedule = scheduleSnap.data() || {};
              shouldReopenSchedule =
                schedule.status === "pending" &&
                schedule.pendingReservationId === reservationId;
            }
          }

          tx.set(
            reservationRef,
            {
              paymentStatus: "expired",
              reservationStatus: "expired",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          if (shouldReopenSchedule && scheduleRef) {
            tx.update(scheduleRef, {
              status: "open",
              isAvailable: true,
              pendingReservationId: admin.firestore.FieldValue.delete(),
              pendingUserId: admin.firestore.FieldValue.delete(),
              pendingExpiresAt: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        });

        logger.info("stripeWebhook: expired session processed", {
          reservationId,
          sessionId: session.id,
          scheduleDocId,
        });
      }
    }

    res.status(200).send("ok");
  } catch (error: any) {
    logger.error("stripeWebhook failed", error);
    res.status(400).send(`Webhook Error: ${error?.message ?? "unknown"}`);
  }
});