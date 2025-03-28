import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Sidebar() {
  const router = useRouter();
  
  // 現在のパスに基づいてアクティブなリンクを判定
  const isActive = (path) => {
    if (path === '/' && router.pathname === '/') {
      return 'bg-gray-800 text-white';
    }
    
    if (path !== '/' && router.pathname.startsWith(path)) {
      return 'bg-gray-800 text-white';
    }
    
    return 'text-gray-300 hover:bg-gray-700 hover:text-white';
  };
  
  return (
    <div className="bg-gray-900 text-white w-64 flex-shrink-0 h-screen">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">売上管理システム</h1>
      </div>
      
      <nav className="mt-5">
        <ul>
          <li>
            <Link href="/" className={`flex items-center px-4 py-3 ${isActive('/')}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              ダッシュボード
            </Link>
          </li>
          <li>
            <Link href="/sales" className={`flex items-center px-4 py-3 ${isActive('/sales')}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              売上管理
            </Link>
          </li>
          <li>
            <Link href="/sales/new" className={`flex items-center px-4 py-3 ${isActive('/sales/new')}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              売上登録
            </Link>
          </li>
          <li>
            <Link href="/monthly-report" className={`flex items-center px-4 py-3 ${isActive('/monthly-report')}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              月次レポート
            </Link>
          </li>
          <li>
            <Link href="/sale-types" className={`flex items-center px-4 py-3 ${isActive('/sale-types')}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              売上種類管理
            </Link>
          </li>
          <li>
            <Link href="/customers" className={`flex items-center px-4 py-3 ${isActive('/customers')}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              顧客管理
            </Link>
          </li>
          <li>
            <Link href="/outsource" className={`flex items-center px-4 py-3 ${isActive('/outsource')}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              外注管理
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}