import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import './index.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ ログインページ表示時に必ず最上部へ
  useEffect(() => {
    const hasRestore = 'scrollRestoration' in window.history;
    const prev = hasRestore ? (window.history as any).scrollRestoration : undefined;
    if (hasRestore) window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return () => {
      if (hasRestore) window.history.scrollRestoration = prev ?? 'auto';
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const redirectTo =
        (location.state as { from?: Location })?.from?.pathname || '/';
      navigate(redirectTo);
    } catch (error) {
      console.error(error);
      setError('メールアドレスまたはパスワードが間違っています。');
    }
  };

  return (
    <div className="login-container">
      {/* ログインフォーム */}
      <div className="login-box">
        <h2>ログイン</h2>
        <form onSubmit={handleLogin} className="login-form">
          <label>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* ✅ チェックボックスとテキストを同じ行に固定 */}
          <div className="checkbox-container">
            <label
              htmlFor="rememberMe"
              className="checkbox-label"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>ログイン状態を保持する</span>
            </label>
          </div>

          <button type="submit" className="login-button">
            ログイン
          </button>

          {error && <p className="error-message">{error}</p>}

          <div className="forgot-password">
            <a href="#">パスワードをお忘れの方</a>
          </div>
        </form>
      </div>

      {/* 新規登録案内 */}
      <div className="register-box">
        <h2>会員登録がまだの方はこちら</h2>
        <p>
          ご利用には会員登録が必要です。
          <br />
          下記リンクより会員登録へお進みください。
        </p>
        <button
          className="register-button"
          onClick={() => navigate('/register')}
        >
          新規会員登録
        </button>
      </div>
    </div>
  );
};

export default Login;
