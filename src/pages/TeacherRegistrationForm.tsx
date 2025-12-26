import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const TeacherRegistrationForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    genre: '',
    area: '',
  });

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    try {
      await addDoc(collection(db, 'teachers'), {
        ...formData,
        createdAt: Timestamp.now(),
      });
      setSuccess('✅ 講師を登録しました');
      setFormData({ name: '', email: '', genre: '', area: '' });
    } catch (err) {
      console.error(err);
      setError('❌ 登録に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <main className="about-section fade-in-up" style={{ maxWidth: '600px', margin: '2rem auto' }}>
      <h2 className="centered-heading-with-border">講師登録フォーム</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>講師名</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>メールアドレス</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label>担当ジャンル（例：ピアノ、油絵）</label>
          <input type="text" name="genre" value={formData.genre} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>担当エリア（例：世田谷区）</label>
          <input type="text" name="area" value={formData.area} onChange={handleChange} />
        </div>

        <button type="submit" className="form-button">講師を登録</button>
      </form>

      {success && <p style={{ color: 'green' }}>{success}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </main>
  );
};

export default TeacherRegistrationForm;
