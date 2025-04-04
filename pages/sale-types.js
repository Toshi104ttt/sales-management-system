import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../utils/supabase';

export default function SaleTypes() {
  const [saleTypes, setSaleTypes] = useState([]);
  const [newSaleType, setNewSaleType] = useState({ name: '', description: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 編集モード用の状態
  const [editMode, setEditMode] = useState(false);
  const [editingSaleType, setEditingSaleType] = useState({ id: '', name: '', description: '' });

  // 売上種類の取得
  useEffect(() => {
    fetchSaleTypes();
  }, []);

  async function fetchSaleTypes() {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('sale_types')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setSaleTypes(data || []);
    } catch (err) {
      console.error('Error fetching sale types:', err);
      setError('売上種類の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function addSaleType(e) {
    e.preventDefault();
    
    if (!newSaleType.name.trim()) {
      setError('種類名を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('sale_types')
        .insert([
          { 
            name: newSaleType.name.trim(),
            description: newSaleType.description.trim() 
          }
        ])
        .select();
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('売上種類を追加しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // フォームをリセット
      setNewSaleType({ name: '', description: '' });
      
      // 一覧を更新
      fetchSaleTypes();
    } catch (err) {
      console.error('Error adding sale type:', err);
      setError('売上種類の追加に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  // 編集モードを開始
  function startEdit(saleType) {
    setEditMode(true);
    setEditingSaleType({
      id: saleType.id,
      name: saleType.name || '',
      description: saleType.description || ''
    });
    
    // ページをフォームの位置までスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  // 編集をキャンセル
  function cancelEdit() {
    setEditMode(false);
    setEditingSaleType({ id: '', name: '', description: '' });
  }
  
  // 売上種類を更新
  async function updateSaleType(e) {
    e.preventDefault();
    
    if (!editingSaleType.name.trim()) {
      setError('種類名を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('sale_types')
        .update({
          name: editingSaleType.name.trim(),
          description: editingSaleType.description.trim()
        })
        .eq('id', editingSaleType.id)
        .select();
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('売上種類を更新しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 編集モードを終了
      setEditMode(false);
      setEditingSaleType({ id: '', name: '', description: '' });
      
      // 一覧を更新
      fetchSaleTypes();
    } catch (err) {
      console.error('Error updating sale type:', err);
      setError('売上種類の更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function deleteSaleType(id) {
    // 未分類は削除できないようにする
    const typeToDelete = saleTypes.find(type => type.id === id);
    if (typeToDelete && typeToDelete.name === '未分類') {
      setError('「未分類」は削除できません');
      return;
    }
    
    if (!confirm('この売上種類を削除してもよろしいですか？\n関連する売上データは未分類になります。')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // まず、この種類を使っている売上データを未分類に更新
      const { data: defaultType } = await supabase
        .from('sale_types')
        .select('id')
        .eq('name', '未分類')
        .single();
        
      if (!defaultType) {
        throw new Error('未分類の種類が見つかりません');
      }
      
      const { error: updateError } = await supabase
        .from('sales')
        .update({ sale_type_id: defaultType.id })
        .eq('sale_type_id', id);
        
      if (updateError) throw updateError;
      
      // 種類を削除
      const { error } = await supabase
        .from('sale_types')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // 成功メッセージを表示
      setSuccessMessage('売上種類を削除しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 一覧を更新
      fetchSaleTypes();
    } catch (err) {
      console.error('Error deleting sale type:', err);
      setError('売上種類の削除に失敗しました: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">売上種類管理</h1>
        
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
        
        {/* 売上種類追加/編集フォーム */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            {editMode ? '売上種類の編集' : '新規売上種類の追加'}
          </h2>
          <form onSubmit={editMode ? updateSaleType : addSaleType}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  種類名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例: YouTube台本製作"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editMode ? editingSaleType.name : newSaleType.name}
                  onChange={(e) => editMode
                    ? setEditingSaleType({...editingSaleType, name: e.target.value})
                    : setNewSaleType({...newSaleType, name: e.target.value})
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明（任意）
                </label>
                <input
                  type="text"
                  placeholder="説明を入力"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editMode ? editingSaleType.description : newSaleType.description}
                  onChange={(e) => editMode
                    ? setEditingSaleType({...editingSaleType, description: e.target.value})
                    : setNewSaleType({...newSaleType, description: e.target.value})
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
                    disabled={isLoading || !editingSaleType.name.trim()}
                  >
                    {isLoading ? '更新中...' : '更新'}
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                  disabled={isLoading || !newSaleType.name.trim()}
                >
                  {isLoading ? '追加中...' : '追加'}
                </button>
              )}
            </div>
          </form>
        </div>
        
        {/* 売上種類一覧 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold p-6 border-b border-gray-200 text-gray-800">売上種類一覧</h2>
          
          {isLoading && <div className="p-4 text-center">読み込み中...</div>}
          
          {!isLoading && saleTypes.length === 0 && (
            <div className="p-4 text-center text-gray-800">
              売上種類が登録されていません
            </div>
          )}
          
          {!isLoading && saleTypes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-gray-800">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                      種類名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                      説明
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-800 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {saleTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {type.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                        {type.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => startEdit(type)}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={isLoading}
                          >
                            編集
                          </button>
                          {/* 未分類は削除できないようにする */}
                          {type.name !== '未分類' && (
                            <button
                              onClick={() => deleteSaleType(type.id)}
                              className="text-red-600 hover:text-red-900"
                              disabled={isLoading}
                            >
                              削除
                            </button>
                          )}
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