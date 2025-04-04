import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../utils/supabase';

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    contact_person: ''
  });
  
  // 編集モード用の状態
  const [editMode, setEditMode] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState({
    id: '',
    name: '',
    contact_person: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    fetchCustomers();
  }, []);
  
  async function fetchCustomers() {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('顧客情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function addCustomer(e) {
    e.preventDefault();
    
    if (!newCustomer.name.trim()) {
      setError('顧客名を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          name: newCustomer.name.trim(),
          contact_person: newCustomer.contact_person.trim()
        }])
        .select();
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('顧客を追加しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // フォームをリセット
      setNewCustomer({
        name: '',
        contact_person: ''
      });
      
      // 一覧を更新
      fetchCustomers();
    } catch (err) {
      console.error('Error adding customer:', err);
      setError('顧客の追加に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  // 編集モードを開始
  function startEdit(customer) {
    setEditMode(true);
    setEditingCustomer({
      id: customer.id,
      name: customer.name || '',
      contact_person: customer.contact_person || ''
    });
    
    // ページをフォームの位置までスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  // 編集をキャンセル
  function cancelEdit() {
    setEditMode(false);
    setEditingCustomer({
      id: '',
      name: '',
      contact_person: ''
    });
  }
  
  // 顧客情報を更新
  async function updateCustomer(e) {
    e.preventDefault();
    
    if (!editingCustomer.name.trim()) {
      setError('顧客名を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .update({
          name: editingCustomer.name.trim(),
          contact_person: editingCustomer.contact_person.trim()
        })
        .eq('id', editingCustomer.id)
        .select();
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('顧客情報を更新しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 編集モードを終了
      setEditMode(false);
      setEditingCustomer({
        id: '',
        name: '',
        contact_person: ''
      });
      
      // 一覧を更新
      fetchCustomers();
    } catch (err) {
      console.error('Error updating customer:', err);
      setError('顧客情報の更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function deleteCustomer(id) {
    if (!confirm('この顧客を削除してもよろしいですか？\n※関連する売上データもすべて削除されます。')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 関連する売上データを取得
      const { data: salesData, error: salesCheckError } = await supabase
        .from('sales')
        .select('id')
        .eq('customer_id', id);
        
      if (salesCheckError) throw salesCheckError;
      
      console.log(`関連する売上データ: ${salesData ? salesData.length : 0}件`);
      
      if (salesData && salesData.length > 0) {
        // 関連する売上データがある場合は削除を確認
        if (!confirm(`この顧客に関連する売上データが${salesData.length}件あります。\nすべて削除しますか？`)) {
          setIsLoading(false);
          return;
        }
        
        // 各売上に対して、削除処理を実行
        for (const sale of salesData) {
          // 1. 売上明細を削除
          console.log(`売上ID: ${sale.id} の売上明細を削除中...`);
          const { error: itemsDeleteError } = await supabase
            .from('sale_items')
            .delete()
            .eq('sale_id', sale.id);
            
          if (itemsDeleteError) {
            console.error('売上明細削除エラー:', itemsDeleteError);
            throw itemsDeleteError;
          }
          
          // 2. 外注コスト情報を削除
          console.log(`売上ID: ${sale.id} の外注コスト情報を削除中...`);
          const { error: costDeleteError } = await supabase
            .from('outsource_costs')
            .delete()
            .eq('sale_id', sale.id);
            
          if (costDeleteError) {
            console.error('外注コスト削除エラー:', costDeleteError);
            throw costDeleteError;
          }
        }
        
        // すべての関連データを削除した後、売上データを削除
        console.log('関連する売上データを削除中...');
        const { error: salesDeleteError } = await supabase
          .from('sales')
          .delete()
          .eq('customer_id', id);
          
        if (salesDeleteError) {
          console.error('売上データ削除エラー:', salesDeleteError);
          throw salesDeleteError;
        }
      }
      
      // 最後に顧客を削除
      console.log(`顧客ID: ${id} を削除中...`);
      const { error: customerDeleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
        
      if (customerDeleteError) {
        console.error('顧客削除エラー:', customerDeleteError);
        throw customerDeleteError;
      }
      
      console.log('顧客削除成功');
      
      // 成功メッセージを表示
      setSuccessMessage('顧客を削除しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 顧客リストを更新（削除した顧客を除外）
      setCustomers(customers.filter(customer => customer.id !== id));
    } catch (err) {
      console.error('Error deleting customer:', err);
      setError(`顧客の削除に失敗しました: ${err.message || 'エラーが発生しました'}`);
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <Layout title="顧客管理">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">顧客管理</h1>
        
        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* 成功メッセージ */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}
        
        {/* 顧客追加/編集フォーム */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {editMode ? '顧客情報の編集' : '新規顧客登録'}
          </h2>
          <form onSubmit={editMode ? updateCustomer : addCustomer}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  顧客名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 株式会社ABC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editMode ? editingCustomer.name : newCustomer.name}
                  onChange={(e) => editMode 
                    ? setEditingCustomer({...editingCustomer, name: e.target.value})
                    : setNewCustomer({...newCustomer, name: e.target.value})
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当者名
                </label>
                <input
                  type="text"
                  placeholder="担当者名を入力"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editMode ? editingCustomer.contact_person : newCustomer.contact_person}
                  onChange={(e) => editMode 
                    ? setEditingCustomer({...editingCustomer, contact_person: e.target.value})
                    : setNewCustomer({...newCustomer, contact_person: e.target.value})
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              {editMode ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={isLoading}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                    disabled={isLoading || !editingCustomer.name.trim()}
                  >
                    {isLoading ? '更新中...' : '更新'}
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                  disabled={isLoading || !newCustomer.name.trim()}
                >
                  {isLoading ? '追加中...' : '登録'}
                </button>
              )}
            </div>
          </form>
        </div>
        
        {/* 顧客一覧 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold text-gray-800 p-6 border-b border-gray-200">顧客一覧</h2>
          
          {isLoading && <div className="p-4 text-center">読み込み中...</div>}
          
          {!isLoading && customers.length === 0 && (
            <div className="p-4 text-center text-gray-800">
              顧客が登録されていません
            </div>
          )}
          
          {!isLoading && customers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                      顧客名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                      担当者
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                        {customer.contact_person || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => startEdit(customer)}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={isLoading}
                          >
                            編集
                          </button>
                          <button
                            onClick={() => deleteCustomer(customer.id)}
                            className="text-red-600 hover:text-red-900"
                            disabled={isLoading}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}