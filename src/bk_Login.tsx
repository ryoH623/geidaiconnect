import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';
import './index.css';

const Login: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hasRestore = 'scrollRestoration' in window.history;
    const prev = hasRestore ? (window.history as any).scrollRestoration : undefined;
    if (hasRestore) window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    return () => {
      if (hasRestore) {
        window.history.scrollRestoration = prev ?? 'auto';
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoginLoading(true);

      await signInWithEmailAndPassword(auth, email, password);

      const redirectTo =
        (location.state as { from?: string } | null)?.from || '/';

      navigate(redirectTo);
    } catch (err) {
      console.error(err);
      setError('メールアドレスまたはパスワードが間違っています。');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setError('');
      setLogoutLoading(true);

      await signOut(auth);

      setEmail('');
      setPassword('');
      setCurrentUser(null);

      alert('ログアウトしました。続けて別のアカウントでログインできます。');
    } catch (err) {
      console.error(err);
      setError('ログアウトに失敗しました。');
    } finally {
      setLogoutLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>ログイン</h2>
          <p>認証状態を確認中です…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>ログイン</h2>

        {currentUser ? (
          <div>
            <p style={{ marginBottom: '1rem' }}>
              現在ログイン中です。
            </p>
            <p style={{ marginBottom: '1rem' }}>
              <strong>メールアドレス：</strong>
              {currentUser.email || '不明'}
            </p>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              別のアカウントでログインするには、先にログアウトしてください。
            </p>

            <button
              type="button"
              className="login-button"
              onClick={handleLogout}
              disabled={logoutLoading}
            >
              {logoutLoading ? 'ログアウト中...' : 'ログアウトする'}
            </button>

            {error && <p className="error-message">{error}</p>}
          </div>
        ) : (
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

            <button type="submit" className="login-button" disabled={loginLoading}>
              {loginLoading ? 'ログイン中...' : 'ログイン'}
            </button>

            {error && <p className="error-message">{error}</p>}

            <div className="forgot-password">
              <a href="#">パスワードをお忘れの方</a>
            </div>
          </form>
        )}
      </div>

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