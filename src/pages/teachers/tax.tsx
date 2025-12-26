// pages/teacher/tax.tsx
import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/router';
import { CSVLink } from 'react-csv';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Reservation {
  id: string;
  lessonDate: string;
  lessonTitle: string;
  studentName: string;
  lessonFee: number;
  commissionRate: number;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
}

const TeacherTaxPage = () => {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!loading && role !== 'teacher') {
      router.push('/unauthorized');
    }
  }, [role, loading]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const resQuery = query(collection(db, 'reservations'), where('teacherId', '==', user.uid));
      const resSnap = await getDocs(resQuery);
      const resData: Reservation[] = resSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          lessonDate: d.lessonDate?.toDate().toISOString(),
          lessonTitle: d.lessonTitle,
          studentName: d.studentName,
          lessonFee: d.lessonFee,
          commissionRate: d.commissionRate,
        };
      });

      const expQuery = query(collection(db, 'expenses'), where('teacherId', '==', user.uid));
      const expSnap = await getDocs(expQuery);
      const expData: Expense[] = expSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          category: d.category,
          amount: d.amount,
          date: d.date.toDate().toISOString(),
        };
      });

      setReservations(resData);
      setExpenses(expData);
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (!selectedMonth) {
      setFilteredReservations(reservations);
      setFilteredExpenses(expenses);
      return;
    }

    const [year, month] = selectedMonth.split('-');
    const filterByMonth = (isoDate: string) => {
      const d = new Date(isoDate);
      return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month);
    };

    setFilteredReservations(reservations.filter(r => filterByMonth(r.lessonDate)));
    setFilteredExpenses(expenses.filter(e => filterByMonth(e.date)));
  }, [selectedMonth, reservations, expenses]);

  const dataWithCalc = filteredReservations.map((r) => {
    const commission = Math.round(r.lessonFee * r.commissionRate);
    return {
      ...r,
      lessonDate: new Date(r.lessonDate).toLocaleDateString(),
      commission,
      netIncome: r.lessonFee - commission,
    };
  });

  const totalRevenue = dataWithCalc.reduce((sum, r) => sum + r.lessonFee, 0);
  const totalCommission = dataWithCalc.reduce((sum, r) => sum + r.commission, 0);
  const totalNet = dataWithCalc.reduce((sum, r) => sum + r.netIncome, 0);
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalNet - totalExpense;

  const headers = [
    { label: '日付', key: 'lessonDate' },
    { label: 'レッスン名', key: 'lessonTitle' },
    { label: '生徒名', key: 'studentName' },
    { label: '金額', key: 'lessonFee' },
    { label: '手数料', key: 'commission' },
    { label: '手取り', key: 'netIncome' },
  ];

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text('レッスン履歴一覧', 14, 16);

    const rows = dataWithCalc.map((r) => [
      r.lessonDate,
      r.lessonTitle,
      r.studentName,
      `¥${r.lessonFee}`,
      `¥${r.commission}`,
      `¥${r.netIncome}`,
    ]);

    // ⬇ 修正点：型エラー回避
    const lessonTable = (doc as any).autoTable({
      head: [['日付', 'レッスン名', '生徒名', '金額', '手数料', '手取り']],
      body: rows,
      startY: 20,
    });

    const expenseRows = filteredExpenses.map((e) => [
      new Date(e.date).toLocaleDateString(),
      e.category,
      `¥${e.amount}`,
    ]);

    doc.text('経費一覧', 14, lessonTable.finalY + 10);
    (doc as any).autoTable({
      head: [['日付', 'カテゴリ', '金額']],
      body: expenseRows,
      startY: lessonTable.finalY + 15,
    });

    doc.save('tax-report.pdf');
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !expenseCategory || !expenseAmount || !expenseDate) return;
    try {
      await addDoc(collection(db, 'expenses'), {
        teacherId: user.uid,
        category: expenseCategory,
        amount: Number(expenseAmount),
        date: new Date(expenseDate),
        createdAt: new Date(),
      });
      setExpenseCategory('');
      setExpenseAmount('');
      setExpenseDate('');
    } catch (err) {
      console.error('経費登録エラー', err);
    }
  };

  if (loading || role !== 'teacher') return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">確定申告サポート</h1>
      <div className="mb-4">
        <label className="mr-2 font-semibold">表示する月：</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border px-2 py-1 rounded"
        />
      </div>
      <div className="mb-6 space-y-1">
        <p>🎵 総売上：¥{totalRevenue.toLocaleString()}</p>
        <p>🧾 手数料合計：¥{totalCommission.toLocaleString()}</p>
        <p>💰 手取り合計：¥{totalNet.toLocaleString()}</p>
        <p>📉 経費合計：¥{totalExpense.toLocaleString()}</p>
        <p className="font-bold">🧮 純利益：¥{netProfit.toLocaleString()}</p>
      </div>
      <table className="table-auto w-full mb-6 border">
        <thead className="bg-gray-200">
          <tr>
            <th className="border px-2 py-1">日付</th>
            <th className="border px-2 py-1">レッスン名</th>
            <th className="border px-2 py-1">生徒名</th>
            <th className="border px-2 py-1">金額</th>
            <th className="border px-2 py-1">手数料</th>
            <th className="border px-2 py-1">手取り</th>
          </tr>
        </thead>
        <tbody>
          {dataWithCalc.map((r) => (
            <tr key={r.id}>
              <td className="border px-2 py-1">{r.lessonDate}</td>
              <td className="border px-2 py-1">{r.lessonTitle}</td>
              <td className="border px-2 py-1">{r.studentName}</td>
              <td className="border px-2 py-1">¥{r.lessonFee}</td>
              <td className="border px-2 py-1">¥{r.commission}</td>
              <td className="border px-2 py-1">¥{r.netIncome}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mb-10">
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          <CSVLink data={dataWithCalc} headers={headers} filename="tax-data.csv">
            CSVダウンロード
          </CSVLink>
        </button>
        <button
          className="bg-green-500 text-white px-4 py-2 rounded"
          onClick={generatePDF}
        >
          PDF出力（レッスン＋経費）
        </button>
      </div>
      <h2 className="text-xl font-bold mb-2">経費入力</h2>
      <form onSubmit={handleAddExpense} className="mb-6 flex flex-col gap-2 max-w-md">
        <select
          value={expenseCategory}
          onChange={(e) => setExpenseCategory(e.target.value)}
          className="border px-2 py-1 rounded"
          required
        >
          <option value="">カテゴリを選択</option>
          <option value="交通費">交通費</option>
          <option value="スタジオ代">スタジオ代</option>
          <option value="教材費">教材費</option>
        </select>
        <input
          type="number"
          placeholder="金額（円）"
          value={expenseAmount}
          onChange={(e) => setExpenseAmount(e.target.value)}
          className="border px-2 py-1 rounded"
          required
        />
        <input
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          className="border px-2 py-1 rounded"
          required
        />
        <button type="submit" className="bg-indigo-500 text-white px-4 py-2 rounded w-fit">
          経費を登録
        </button>
      </form>
      <h2 className="text-xl font-bold mb-2">経費一覧</h2>
      <table className="table-auto w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">日付</th>
            <th className="border px-2 py-1">カテゴリ</th>
            <th className="border px-2 py-1">金額</th>
          </tr>
        </thead>
        <tbody>
          {filteredExpenses.map((e) => (
            <tr key={e.id}>
              <td className="border px-2 py-1">{new Date(e.date).toLocaleDateString()}</td>
              <td className="border px-2 py-1">{e.category}</td>
              <td className="border px-2 py-1">¥{e.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeacherTaxPage;
