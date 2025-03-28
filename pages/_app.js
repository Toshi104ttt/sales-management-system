import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

// グローバルスタイルがある場合はここでインポート
// import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window !== 'undefined') {
      const checkAuth = () => {
        const auth = localStorage.getItem('isAuthenticated') === 'true';
        setIsAuthenticated(auth);
        
        // loginページ以外で未認証の場合はリダイレクト
        if (!auth && router.pathname !== '/login') {
          router.push('/login');
        }
        
        setLoading(false);
      };
      
      checkAuth();
      
      // ルート変更時にも認証チェック
      router.events.on('routeChangeComplete', checkAuth);
      
      return () => {
        router.events.off('routeChangeComplete', checkAuth);
      };
    }
  }, [router]);

  // まだローディング中
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      読み込み中...
    </div>;
  }

  // loginページの場合はそのまま表示
  if (router.pathname === '/login') {
    return <Component {...pageProps} />;
  }

  // 認証済みの場合のみ他のページを表示
  if (isAuthenticated) {
    return <Component {...pageProps} />;
  }

  // 未認証（リダイレクト中）
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    ログインページにリダイレクトしています...
  </div>;
}

export default MyApp;