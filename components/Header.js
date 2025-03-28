// components/Header.js
import React from 'react';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
      <h2 className="text-xl font-semibold">ダッシュボード</h2>
      <div className="flex items-center space-x-4">
        <select className="border rounded px-2 py-1 text-sm">
          <option>メインPC</option>
          <option>サブPC</option>
          <option>ノートPC</option>
        </select>
        <span className="text-sm">ようこそ、管理者さん</span>
      </div>
    </header>
  );
}