import React from 'react';

export default function SummaryCard({ title, value, icon, color = 'bg-blue-100 text-blue-500' }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`${color} p-3 rounded-full`}>
          {icon}
        </div>
        <div className="ml-4">
          <h3 className="text-gray-500 text-sm">{title}</h3>
          <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
}