import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabase';

export default function SaleForm({ editMode = false, saleId = null }) {
  const router = useRouter();
  
  const [sale, setSale] = useState({
    customer_id: '',
    user_name: '',
    sale_date: new Date().toISOString().split('T')[0],
    delivery_date: '', // 納品日追加
    total_amount: '',
    sale_status: '完了',
    source: '',
    notes: '',
    sale_type_id: ''
  });
  
  const [customers, setCustomers] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]); // 売上種類
  const [outsources, setOutsources] = useState([]); // 外注先
  const [outsourceCost, setOutsourceCost] = useState({
    outsource_id: '',
    amount: '',
    description: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    fetchCustomers();
    fetchSaleTypes();
    fetchOutsources();
    
    if (editMode && saleId) {
      fetchSaleDetails(saleId);
    }
  }, [editMode, saleId]);
  
  async function fetchCustomers() {
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
    }
  }
  
  async function fetchSaleTypes() {
    try {
      const { data, error } = await supabase
        .from('sale_types')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setSaleTypes(data || []);
      
      // 初期値として「未分類」を設定
      const defaultType = data?.find(type => type.name === '未分類');
      if (defaultType && !editMode) {
        setSale(prev => ({ ...prev, sale_type_id: defaultType.id }));
      }
    } catch (err) {
      console.error('Error fetching sale types:', err);
      setError('売上種類の取得に失敗しました');
    }
  }
  
  async function fetchOutsources() {
    try {
      const { data, error } = await supabase
        .from('outsources')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setOutsources(data || []);
    } catch (err) {
      console.error('Error fetching outsources:', err);
      setError('外注先情報の取得に失敗しました');
    }
  }
  
  async function fetchSaleDetails(id) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        // ユーザーIDからユーザー名を取得
        let userName = '';
        if (data.user_id) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name')
            .eq('id', data.user_id)
            .single();
            
          if (!userError && userData) {
            userName = userData.name;
          }
        }
        
        setSale({
          ...data,
          user_name: userName, // user_id の代わりに user_name を設定
          sale_date: data.sale_date?.split('T')[0] || new Date().toISOString().split('T')[0]
        });
        
        // 外注コスト情報も取得
        const { data: costData, error: costError } = await supabase
          .from('outsource_costs')
          .select('*')
          .eq('sale_id', id)
          .single();
          
        if (!costError && costData) {
          setOutsourceCost({
            outsource_id: costData.outsource_id,
            amount: costData.amount,
            description: costData.description || ''
          });
        }
      }
    } catch (err) {
      console.error('Error fetching sale details:', err);
      setError('売上情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSale({
      ...sale,
      [name]: value
    });
  };
  
  const handleOutsourceCostChange = (e) => {
    const { name, value } = e.target;
    setOutsourceCost({
      ...outsourceCost,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!sale.customer_id || !sale.sale_date || !sale.total_amount) {
      setError('必須項目を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      let saleData = { ...sale };
      
      // user_name を保存する (user_id は使用しない)
      delete saleData.user_id; // user_id フィールドを削除
      
      // 数値型のフィールドを変換
      saleData.total_amount = parseFloat(saleData.total_amount) || 0;
      
      let result;
      
      if (editMode && saleId) {
        // 更新処理
        const { data, error } = await supabase
          .from('sales')
          .update(saleData)
          .eq('id', saleId)
          .select();
          
        if (error) throw error;
        result = data[0];
        
        // 成功メッセージ
        setSuccessMessage('売上情報を更新しました');
      } else {
        // 新規作成処理
        const { data, error } = await supabase
          .from('sales')
          .insert([saleData])
          .select();
          
        if (error) throw error;
        result = data[0];
        
        // 成功メッセージ
        setSuccessMessage('売上情報を登録しました');
      }
      
      // 外注コストの処理
      if (outsourceCost.outsource_id && outsourceCost.amount) {
        const costAmount = parseFloat(outsourceCost.amount) || 0;
        
        if (costAmount > 0) {
          // 既存の外注コスト情報を削除
          if (editMode && saleId) {
            await supabase
              .from('outsource_costs')
              .delete()
              .eq('sale_id', saleId);
          }
          
          // 外注コスト情報を登録
          const { error: costError } = await supabase
            .from('outsource_costs')
            .insert([{
              sale_id: result.id,
              outsource_id: outsourceCost.outsource_id,
              amount: costAmount,
              description: outsourceCost.description
            }]);
            
          if (costError) throw costError;
        }
      }
      
      // 成功後の処理
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      console.error('Error saving sale:', err);
      setError(editMode ? '売上情報の更新に失敗しました' : '売上情報の登録に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-semibold mb-6">
        {editMode ? '売上情報の編集' : '新規売上登録'}
      </h1>
      
      {/* エラーメッセージ */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {/* 成功メッセージ */}
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
          <p>{successMessage}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 顧客選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              顧客 <span className="text-red-500">*</span>
            </label>
            <select
              name="customer_id"
              value={sale.customer_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">選択してください</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* 担当者入力 (テキストフィールドに変更) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              担当者
            </label>
            <input
              type="text"
              name="user_name"
              value={sale.user_name}
              onChange={handleChange}
              placeholder="担当者名を入力"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* 売上日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              売上日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="sale_date"
              value={sale.sale_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* 納品日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              納品日
            </label>
            <input
              type="date"
              name="delivery_date"
              value={sale.delivery_date || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* 売上金額 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              売上金額 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                ¥
              </span>
              <input
                type="number"
                name="total_amount"
                value={sale.total_amount}
                onChange={handleChange}
                className="w-full pl-8 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
                required
              />
            </div>
          </div>
          
          {/* ステータス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ステータス
            </label>
            <select
              name="sale_status"
              value={sale.sale_status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="進行中">進行中</option>
              <option value="完了">完了</option>
              <option value="保留中">保留中</option>
              <option value="キャンセル">キャンセル</option>
            </select>
          </div>
          
          {/* 売上種類 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              売上種類
            </label>
            <select
              name="sale_type_id"
              value={sale.sale_type_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {saleTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* 問い合わせ元 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              問い合わせ元
            </label>
            <input
              type="text"
              name="source"
              value={sale.source}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 紹介、ウェブサイト等"
            />
          </div>
        </div>
        
        {/* 外注情報 */}
        <div className="mt-8 border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">外注情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 外注先選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                外注先
              </label>
              <select
                name="outsource_id"
                value={outsourceCost.outsource_id}
                onChange={handleOutsourceCostChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選択してください</option>
                {outsources.map((outsource) => (
                  <option key={outsource.id} value={outsource.id}>
                    {outsource.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 外注コスト */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                外注費用
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  ¥
                </span>
                <input
                  type="number"
                  name="amount"
                  value={outsourceCost.amount}
                  onChange={handleOutsourceCostChange}
                  className="w-full pl-8 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            
            {/* 外注内容 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                外注内容
              </label>
              <input
                type="text"
                name="description"
                value={outsourceCost.description}
                onChange={handleOutsourceCostChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: YouTube台本作成等"
              />
            </div>
          </div>
        </div>
        
        {/* 備考 */}
        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            備考
          </label>
          <textarea
            name="notes"
            value={sale.notes}
            onChange={handleChange}
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="備考を入力してください"
          ></textarea>
        </div>
        
        {/* ボタン */}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="mr-4 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? '保存中...' : (editMode ? '更新する' : '登録する')}
          </button>
        </div>
      </form>
    </div>
  );
}