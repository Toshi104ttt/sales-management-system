// components/CompleteSaleButton.js
import React, { useState } from 'react';
import { supabase } from '../utils/supabase';

export default function CompleteSaleButton({ saleId, onComplete }) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  async function completeSale() {
    if (!confirm('この案件を完了としてマークしますか？')) {
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('sales')
        .update({ sale_status: '完了' })
        .eq('id', saleId);
        
      if (error) throw error;
      
      // 親コンポーネントに完了を通知
      if (onComplete) {
        onComplete(saleId);
      }
    } catch (err) {
      console.error('Error updating sale status:', err);
      alert('ステータスの更新に失敗しました: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  }
  
  return (
    <button
      onClick={completeSale}
      className="text-green-600 hover:text-green-900"
      disabled={isUpdating}
    >
      {isUpdating ? '更新中...' : '完了'}
    </button>
  );
}