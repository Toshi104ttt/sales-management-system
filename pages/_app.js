// pages/_app.js を簡略化
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(auth);
      
      if (!auth && router.pathname !== '/login') {
        router.push('/login');
      }
      
      setLoading(false);
    }
  }, [router]);

  // 認証チェックのみを行い、コンポーネント自体はそのまま表示
  if (router.pathname === '/login' || isAuthenticated) {
    return <Component {...pageProps} />;
  }

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return <div>リダイレクト中...</div>;
}

export default MyApp;