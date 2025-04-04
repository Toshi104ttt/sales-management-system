import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../utils/supabase';

export default function OutsourceManagement() {
  const [outsources, setOutsources] = useState([]);
  const [outsourceCosts, setOutsourceCosts] = useState([]);
  const [newOutsource, setNewOutsource] = useState({
    name: '',
    email: '',
    notes: ''
  });
  const [expandedOutsource, setExpandedOutsource] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 編集モード用の状態
  const [editMode, setEditMode] = useState(false);
  const [editingOutsource, setEditingOutsource] = useState({
    id: '',
    name: '',
    email: '',
    notes: ''
  });
  
  useEffect(() => {
    fetchOutsources();
    fetchOutsourceCosts();
  }, []);
  
  async function fetchOutsources() {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('outsources')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setOutsources(data || []);
    } catch (err) {
      console.error('Error fetching outsources:', err);
      setError('外注先の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function fetchOutsourceCosts() {
    setIsLoading(true);
    
    try {
      // 外注コスト情報を取得
      const { data, error } = await supabase
        .from('outsource_costs')
        .select(`
          id,
          amount,
          description,
          created_at,
          outsource:outsource_id(id, name),
          sale:sale_id(id, sale_date, total_amount, customer_id)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // 顧客情報を取得
      const customerIds = [...new Set(data.map(cost => cost.sale.customer_id))];
      const { data: customers, error: customerError } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);
        
      if (customerError) throw customerError;
      
      // 顧客情報をマッピング
      const customerMap = {};
      customers.forEach(customer => {
        customerMap[customer.id] = customer.name;
      });
      
      // 外注先ごとにコストを集計
      const costsByOutsource = {};
      data.forEach(cost => {
        const outsourceId = cost.outsource.id;
        if (!costsByOutsource[outsourceId]) {
          costsByOutsource[outsourceId] = {
            id: outsourceId,
            name: cost.outsource.name,
            totalCost: 0,
            sales: []
          };
        }
        
        costsByOutsource[outsourceId].totalCost += cost.amount;
        costsByOutsource[outsourceId].sales.push({
          id: cost.id,
          saleId: cost.sale.id,
          date: cost.sale.sale_date,
          customer: customerMap[cost.sale.customer_id] || '不明',
          totalAmount: cost.sale.total_amount,
          amount: cost.amount,
          description: cost.description
        });
      });
      
      // 配列に変換してセット
      setOutsourceCosts(Object.values(costsByOutsource));
    } catch (err) {
      console.error('Error fetching outsource costs:', err);
      setError('外注コストの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  // 編集モードを開始
  function startEdit(outsource) {
    setEditMode(true);
    setEditingOutsource({
      id: outsource.id,
      name: outsource.name || '',
      email: outsource.email || '',
      notes: outsource.notes || ''
    });
    
    // ページをフォームの位置までスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  // 編集をキャンセル
  function cancelEdit() {
    setEditMode(false);
    setEditingOutsource({
      id: '',
      name: '',
      email: '',
      notes: ''
    });
  }
  
  // 外注先を更新
  async function updateOutsource(e) {
    e.preventDefault();
    
    if (!editingOutsource.name.trim()) {
      setError('外注先名を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('outsources')
        .update({
          name: editingOutsource.name.trim(),
          email: editingOutsource.email.trim(),
          notes: editingOutsource.notes.trim()
        })
        .eq('id', editingOutsource.id)
        .select();
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('外注先情報を更新しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 編集モードを終了
      setEditMode(false);
      setEditingOutsource({
        id: '',
        name: '',
        email: '',
        notes: ''
      });
      
      // 一覧を更新
      fetchOutsources();
    } catch (err) {
      console.error('Error updating outsource:', err);
      setError('外注先情報の更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function addOutsource(e) {
    e.preventDefault();
    
    if (!newOutsource.name.trim()) {
      setError('外注先名を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('outsources')
        .insert([{
          name: newOutsource.name.trim(),
          email: newOutsource.email.trim(),
          notes: newOutsource.notes.trim()
        }])
        .select();
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('外注先を追加しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // フォームをリセット
      setNewOutsource({
        name: '',
        email: '',
        notes: ''
      });
      
      // 一覧を更新
      fetchOutsources();
    } catch (err) {
      console.error('Error adding outsource:', err);
      setError('外注先の追加に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function deleteOutsource(id) {
    if (!confirm('この外注先を削除してもよろしいですか？\n関連するコスト情報も削除されます。')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // まず、関連するコスト情報を削除
      const { error: costsError } = await supabase
        .from('outsource_costs')
        .delete()
        .eq('outsource_id', id);
        
      if (costsError) throw costsError;
      
      // 外注先を削除
      const { error } = await supabase
        .from('outsources')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('外注先を削除しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 一覧を更新
      fetchOutsources();
      fetchOutsourceCosts();
    } catch (err) {
      console.error('Error deleting outsource:', err);
      setError('外注先の削除に失敗しました: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }
  
  function toggleOutsourceDetails(id) {
    if (expandedOutsource === id) {
      setExpandedOutsource(null);
    } else {
      setExpandedOutsource(id);
    }
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">外注管理</h1>
        
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
        
        {/* 外注先追加/編集フォーム */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {editMode ? '外注先情報の編集' : '新規外注先の登録'}
          </h2>
          <form onSubmit={editMode ? updateOutsource : addOutsource}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  外注先名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 株式会社A制作"
                  className="w-full px-3 py-2 text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editMode ? editingOutsource.name : newOutsource.name}
                  onChange={(e) => editMode
                    ? setEditingOutsource({...editingOutsource, name: e.target.value})
                    : setNewOutsource({...newOutsource, name: e.target.value})
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  placeholder="example@example.com"
                  className="w-full px-3 py-2 text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editMode ? editingOutsource.email : newOutsource.email}
                  onChange={(e) => editMode
                    ? setEditingOutsource({...editingOutsource, email: e.target.value})
                    : setNewOutsource({...newOutsource, email: e.target.value})
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考
                </label>
                <textarea
                  placeholder="備考を入力"
                  className="w-full px-3 py-2 text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  value={editMode ? editingOutsource.notes : newOutsource.notes}
                  onChange={(e) => editMode
                    ? setEditingOutsource({...editingOutsource, notes: e.target.value})
                    : setNewOutsource({...newOutsource, notes: e.target.value})
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
                    disabled={isLoading || !editingOutsource.name.trim()}
                  >
                    {isLoading ? '更新中...' : '更新'}
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                  disabled={isLoading || !newOutsource.name.trim()}
                >
                  {isLoading ? '追加中...' : '追加'}
                </button>
              )}
            </div>
          </form>
        </div>
        
        {/* 外注先一覧 */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <h2 className="text-xl font-semibold p-6 border-b border-gray-200 text-gray-800">外注先一覧</h2>
          
          {isLoading && <div className="p-4 text-center text-gray-800">読み込み中...</div>}
          
          {!isLoading && outsources.length === 0 && (
            <div className="p-4 text-center text-gray-800">
              外注先が登録されていません
            </div>
          )}
          
          {!isLoading && outsources.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                      外注先名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                      連絡先
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {outsources.map((outsource) => (
                    <tr key={outsource.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                        {outsource.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                        {outsource.email ? (
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {outsource.email}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-800">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => startEdit(outsource)}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={isLoading}
                          >
                            編集
                          </button>
                          <button
                            onClick={() => deleteOutsource(outsource.id)}
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
        
        {/* 外注コスト集計 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold p-6 border-b border-gray-200 text-gray-800">外注コスト集計</h2>
          
          {isLoading && <div className="p-4 text-center">読み込み中...</div>}
          
          {!isLoading && outsourceCosts.length === 0 && (
            <div className="p-4 text-center text-gray-800">
              外注コスト情報がありません
            </div>
          )}
          
          {!isLoading && outsourceCosts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                      外注先
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider">
                      総コスト
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider">
                      件数
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider">
                      詳細
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-gray-800">
                  {outsourceCosts.map((outsource) => (
                    <React.Fragment key={outsource.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {outsource.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          ¥{outsource.totalCost.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {outsource.sales.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => toggleOutsourceDetails(outsource.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {expandedOutsource === outsource.id ? '詳細を閉じる' : '詳細を見る'}
                          </button>
                        </td>
                      </tr>
                      
                      {/* 詳細表示 */}
                      {expandedOutsource === outsource.id && (
                        <tr>
                          <td colSpan="4" className="px-0 py-0">
                            <div className="border-t border-gray-200 bg-gray-50 p-4">
                              <h3 className="text-lg font-medium mb-3">{outsource.name} の発注履歴</h3>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">日付</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">顧客</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-800">発注金額</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">内容</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {outsource.sales.map((sale) => (
                                      <tr key={sale.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                          {new Date(sale.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                          {sale.customer}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                                          ¥{sale.amount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                          {sale.description || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-gray-50">
                                    <tr>
                                      <td colSpan="2" className="px-4 py-2 text-right font-medium">合計</td>
                                      <td className="px-4 py-2 text-right font-medium">
                                        ¥{outsource.totalCost.toLocaleString()}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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