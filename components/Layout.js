import React from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import Link from 'next/link';

export default function Layout({ children, title = '売上管理システム' }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content="小規模事業者向け売上管理システム" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-auto">
          {/* ヘッダー */}
          <header className="bg-white shadow z-10">
            <div className="mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Link href="/sales/new" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    新規売上登録
                  </Link>
                </div>
              </div>
            </div>
          </header>
          
          {/* メインコンテンツ */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}