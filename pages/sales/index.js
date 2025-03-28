import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { supabase } from '../../utils/supabase';

export default function SalesManagement() {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 編集モード用の状態を追加
  const [editMode, setEditMode] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 外注先一覧と担当者一覧（編集フォームで使用）
  const [outsources, setOutsources] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // 納期超過の判定
  const isOverdue = (deliveryDate) => {
    if (!deliveryDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const delivery = new Date(deliveryDate);
    return delivery < today;
  };
  
  // フィルター用の状態
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    startDeliveryDate: '', // 納品日開始
    endDeliveryDate: '',   // 納品日終了
    customerName: '',
    saleTypeId: '',
    minAmount: '',
    maxAmount: '',
    status: ''
  });
  
  // 売上種類のリスト
  const [saleTypes, setSaleTypes] = useState([]);
  
  // ページング用の状態
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  
  // 並び替え用の状態
  const [sortField, setSortField] = useState('sale_date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // フィルターの表示/非表示状態
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  useEffect(() => {
    fetchSaleTypes();
    fetchSales();
    fetchCustomers();
    fetchOutsources();
  }, [page, sortField, sortOrder]);
  
  // 売上種類を取得
  async function fetchSaleTypes() {
    try {
      const { data, error } = await supabase
        .from('sale_types')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setSaleTypes(data || []);
    } catch (err) {
      console.error('Error fetching sale types:', err);
    }
  }
  
  // 顧客リストを取得
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
    }
  }
  
  // 外注先リストを取得
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
    }
  }
  
  // 売上データを取得
  async function fetchSales() {
    setIsLoading(true);
    setError(null);
    
    try {
      // クエリを構築
      let query = supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          delivery_date,
          total_amount,
          sale_status,
          customer:customer_id(id, name),
          user_name,
          sale_type:sale_type_id(id, name),
          notes
        `, { count: 'exact' })
        .order(sortField, { ascending: sortOrder === 'asc' });
      
      // フィルターを適用
      if (filters.startDate) {
        query = query.gte('sale_date', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte('sale_date', filters.endDate);
      }
      
      if (filters.startDeliveryDate) {
        query = query.gte('delivery_date', filters.startDeliveryDate);
      }
      
      if (filters.endDeliveryDate) {
        query = query.lte('delivery_date', filters.endDeliveryDate);
      }
      
      if (filters.saleTypeId) {
        query = query.eq('sale_type_id', filters.saleTypeId);
      }
      
      if (filters.minAmount) {
        query = query.gte('total_amount', parseFloat(filters.minAmount));
      }
      
      if (filters.maxAmount) {
        query = query.lte('total_amount', parseFloat(filters.maxAmount));
      }
      
      if (filters.status) {
        query = query.eq('sale_status', filters.status);
      }
      
      if (filters.customerName) {
        // 顧客名で検索する場合は別途取得
        const { data: customers, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .ilike('name', `%${filters.customerName}%`);
          
        if (customerError) throw customerError;
        
        const customerIds = customers.map(c => c.id);
        if (customerIds.length > 0) {
          query = query.in('customer_id', customerIds);
        } else {
          // 該当する顧客がいない場合は空の結果を返す
          setSales([]);
          setTotalPages(0);
          setIsLoading(false);
          return;
        }
      }
      
      // ページングを適用
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      query = query.range(from, to);
      
      // クエリを実行
      const { data, error, count } = await query;
        
      if (error) throw error;
      
      // 外注コスト情報を取得
      const saleIds = data.map(sale => sale.id);
      let outsourceCosts = {};
      
      if (saleIds.length > 0) {
        const { data: costsData, error: costsError } = await supabase
          .from('outsource_costs')
          .select(`
            sale_id,
            outsource:outsource_id(id, name),
            amount
          `)
          .in('sale_id', saleIds);
          
        if (costsError) throw costsError;
        
        // 売上IDごとに外注コストをグループ化
        costsData.forEach(cost => {
          const saleId = cost.sale_id;
          if (!outsourceCosts[saleId]) {
            outsourceCosts[saleId] = [];
          }
          outsourceCosts[saleId].push({
            outsourceName: cost.outsource.name,
            amount: cost.amount
          });
        });
      }
      
      // 売上データに外注コスト情報を追加し、利益を計算
      const salesWithCosts = data.map(sale => {
        const saleOutsourceCosts = outsourceCosts[sale.id] || [];
        const totalOutsourceCost = saleOutsourceCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);
        const profit = (sale.total_amount || 0) - totalOutsourceCost;
        
        return {
          ...sale,
          outsourceCosts: saleOutsourceCosts,
          outsourceCostTotal: totalOutsourceCost,
          profit: profit
        };
      });
      
      setSales(salesWithCosts);
      
      // 総ページ数を計算
      const totalItems = count || 0;
      setTotalPages(Math.ceil(totalItems / itemsPerPage));
    } catch (err) {
      console.error('Error fetching sales:', err);
      setError('売上データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  // 編集モードを開始
  function startEdit(sale) {
    // 選択された売上データを編集用にセット
    setEditingSale({
      id: sale.id,
      customer_id: sale.customer?.id || '',
      user_name: sale.user_name || '',
      sale_date: sale.sale_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      delivery_date: sale.delivery_date?.split('T')[0] || '',
      total_amount: sale.total_amount || '',
      sale_status: sale.sale_status || '進行中',
      sale_type_id: sale.sale_type?.id || '',
      notes: sale.notes || '',
      outsource_id: '', // 外注情報は別に取得
      outsource_amount: ''
    });
    
    // 外注コスト情報を取得
    fetchSaleOutsourceCosts(sale.id);
    
    // 編集モードを有効にする
    setEditMode(true);
    
    // ページを先頭にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  // 外注コスト情報を取得
  async function fetchSaleOutsourceCosts(saleId) {
    try {
      const { data, error } = await supabase
        .from('outsource_costs')
        .select('*, outsource:outsource_id(id, name)')
        .eq('sale_id', saleId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116はレコードが見つからない場合のエラーコード
        throw error;
      }
      
      if (data) {
        // 外注情報が存在する場合
        setEditingSale(prev => ({
          ...prev,
          outsource_id: data.outsource_id || '',
          outsource_amount: data.amount || ''
        }));
      }
    } catch (err) {
      console.error('Error fetching outsource costs:', err);
    }
  }
  
  // 編集をキャンセル
  function cancelEdit() {
    setEditMode(false);
    setEditingSale(null);
  }
  
  // 編集データの変更ハンドラー
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingSale(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 売上更新処理
  async function updateSale(e) {
    e.preventDefault();
    
    if (!editingSale.customer_id || !editingSale.sale_date || !editingSale.total_amount) {
      setError('必須項目を入力してください');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 売上データを更新
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          customer_id: editingSale.customer_id,
          user_name: editingSale.user_name,
          sale_date: editingSale.sale_date,
          delivery_date: editingSale.delivery_date || null,
          total_amount: parseFloat(editingSale.total_amount),
          sale_status: editingSale.sale_status,
          sale_type_id: editingSale.sale_type_id || null,
          notes: editingSale.notes
        })
        .eq('id', editingSale.id);
        
      if (updateError) throw updateError;
      
      // 外注コスト情報を更新
      if (editingSale.outsource_id && editingSale.outsource_amount) {
        // まず既存の外注コストを削除
        const { error: deleteError } = await supabase
          .from('outsource_costs')
          .delete()
          .eq('sale_id', editingSale.id);
          
        if (deleteError) throw deleteError;
        
        // 新しい外注コストを登録
        const { error: insertError } = await supabase
          .from('outsource_costs')
          .insert({
            sale_id: editingSale.id,
            outsource_id: editingSale.outsource_id,
            amount: parseFloat(editingSale.outsource_amount)
          });
          
        if (insertError) throw insertError;
      } else {
        // 外注情報が無い場合は削除のみ
        const { error: deleteError } = await supabase
          .from('outsource_costs')
          .delete()
          .eq('sale_id', editingSale.id);
          
        if (deleteError) throw deleteError;
      }
      
      // 成功メッセージを表示
      setSuccessMessage('売上情報を更新しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 編集モードを終了
      setEditMode(false);
      setEditingSale(null);
      
      // 売上一覧を更新
      fetchSales();
    } catch (err) {
      console.error('Error updating sale:', err);
      setError(`売上情報の更新に失敗しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }
  
  // フィルターをリセット
  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      startDeliveryDate: '',
      endDeliveryDate: '',
      customerName: '',
      saleTypeId: '',
      minAmount: '',
      maxAmount: '',
      status: ''
    });
    setPage(1);  // ページもリセット
  };
  
  // フィルターを適用
  const applyFilters = () => {
    setPage(1);  // フィルター適用時はページを1に戻す
    fetchSales();
  };
  
  // フィルター変更ハンドラー
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 並び替えハンドラー
  const handleSort = (field) => {
    if (field === sortField) {
      // 同じフィールドの場合は並び順を反転
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 新しいフィールドの場合は降順で開始
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  // ステータスに応じたスタイルを取得
  const getStatusStyle = (status) => {
    switch (status) {
      case '完了':
        return 'bg-green-100 text-green-800';
      case '進行中':
        return 'bg-yellow-100 text-yellow-800';
      case '保留中':
        return 'bg-orange-100 text-orange-800';
      case 'キャンセル':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // 売上を削除
  async function deleteSale(id) {
    if (!confirm('この売上を削除してもよろしいですか？')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`売上ID: ${id} の削除を開始します...`);
      
      // 1. まず、関連する売上明細を削除
      console.log(`売上明細を削除中...`);
      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', id);
        
      if (itemsError) {
        console.error('売上明細の削除エラー:', itemsError);
        throw itemsError;
      }
      
      // 2. 次に、関連する外注コストを削除
      console.log(`外注コスト情報を削除中...`);
      const { error: costsError } = await supabase
        .from('outsource_costs')
        .delete()
        .eq('sale_id', id);
        
      if (costsError) {
        console.error('外注コストの削除エラー:', costsError);
        throw costsError;
      }
      
      // 3. 最後に売上自体を削除
      console.log(`売上を削除中...`);
      const { error: saleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);
        
      if (saleError) {
        console.error('売上の削除エラー:', saleError);
        throw saleError;
      }
      
      console.log('売上削除成功');
      
      // 削除成功メッセージを表示
      alert('売上を削除しました');
      
      // 一覧を更新
      fetchSales();
    } catch (err) {
      console.error('Error deleting sale:', err);
      setError(`売上の削除に失敗しました: ${err.message || 'エラーが発生しました'}`);
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <Layout title="売上管理">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">売上管理</h1>
          <Link href="/sales/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規売上登録
          </Link>
        </div>
        
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
        
        {/* 編集フォーム - 編集モード時のみ表示 */}
        {editMode && editingSale && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">売上情報の編集</h2>
            <form onSubmit={updateSale}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 顧客選択 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    顧客 <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="customer_id"
                    value={editingSale.customer_id}
                    onChange={handleEditChange}
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
                
                {/* 担当者入力 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当者
                  </label>
                  <input
                    type="text"
                    name="user_name"
                    value={editingSale.user_name}
                    onChange={handleEditChange}
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
                    value={editingSale.sale_date}
                    onChange={handleEditChange}
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
                    value={editingSale.delivery_date || ''}
                    onChange={handleEditChange}
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
                      value={editingSale.total_amount}
                      onChange={handleEditChange}
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
                    value={editingSale.sale_status}
                    onChange={handleEditChange}
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
                    value={editingSale.sale_type_id}
                    onChange={handleEditChange}
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
                
                {/* 外注先 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    外注先
                  </label>
                  <select
                    name="outsource_id"
                    value={editingSale.outsource_id}
                    onChange={handleEditChange}
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
                
                {/* 外注費用 */}
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
                      name="outsource_amount"
                      value={editingSale.outsource_amount}
                      onChange={handleEditChange}
                      className="w-full pl-8 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>
              
              {/* 備考 */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考
                </label>
                <textarea
                  name="notes"
                  value={editingSale.notes}
                  onChange={handleEditChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="備考を入力"
                ></textarea>
              </div>
              
              {/* ボタン */}
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? '更新中...' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* フィルターセクション */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div 
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <h2 className="text-lg font-semibold">検索・フィルター</h2>
            <div className="text-gray-500">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 transition-transform ${isFilterExpanded ? 'transform rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {isFilterExpanded && (
            <div className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了日
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    納品日（開始）
                  </label>
                  <input
                    type="date"
                    name="startDeliveryDate"
                    value={filters.startDeliveryDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    納品日（終了）
                  </label>
                  <input
                    type="date"
                    name="endDeliveryDate"
                    value={filters.endDeliveryDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    顧客名
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={filters.customerName}
                    onChange={handleFilterChange}
                    placeholder="顧客名で検索"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    売上種類
                  </label>
                  <select
                    name="saleTypeId"
                    value={filters.saleTypeId}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">すべて</option>
                    {saleTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最小金額
                  </label>
                  <input
                    type="number"
                    name="minAmount"
                    value={filters.minAmount}
                    onChange={handleFilterChange}
                    placeholder="最小金額"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大金額
                  </label>
                  <input
                    type="number"
                    name="maxAmount"
                    value={filters.maxAmount}
                    onChange={handleFilterChange}
                    placeholder="最大金額"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ステータス
                  </label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">すべて</option>
                    <option value="進行中">進行中</option>
                    <option value="完了">完了</option>
                    <option value="保留中">保留中</option>
                    <option value="キャンセル">キャンセル</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  リセット
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  検索
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* 売上一覧表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">売上一覧</h2>
          </div>
          
          {isLoading ? (
            <div className="p-6 text-center">
              <svg className="animate-spin h-8 w-8 mx-auto text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-gray-500">読み込み中...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              売上データがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('sale_date')}
                  >
                    <div className="flex items-center">
                      日付
                      {sortField === 'sale_date' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('delivery_date')}
                  >
                    <div className="flex items-center">
                      納品日
                      {sortField === 'delivery_date' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    顧客
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    担当者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    種類
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('total_amount')}
                  >
                    <div className="flex items-center justify-end">
                      金額
                      {sortField === 'total_amount' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    className={`hover:bg-gray-50 ${sale.sale_status === '進行中' && isOverdue(sale.delivery_date) ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {sale.delivery_date ? (
                        <span className={
                          sale.sale_status === '進行中' && isOverdue(sale.delivery_date) 
                            ? 'text-red-600 font-medium' 
                            : 'text-gray-900'
                        }>
                          {new Date(sale.delivery_date).toLocaleDateString()}
                          {sale.sale_status === '進行中' && isOverdue(sale.delivery_date) && ' (遅延)'}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        {sale.customer?.name || '不明'}
                      </div>
                      {sale.outsourceCosts.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          外注: {sale.outsourceCosts.map(cost => cost.outsourceName).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.user_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.sale_type?.name || '未分類'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ¥{sale.total_amount.toLocaleString()}
                      <div className="text-xs text-gray-500">
                        利益: ¥{sale.profit.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusStyle(sale.sale_status)}`}>
                        {sale.sale_status || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => startEdit(sale)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => deleteSale(sale.id)}
                          className="text-red-600 hover:text-red-900"
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
          
          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between border-t">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  前へ
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    全{totalPages}ページ中 <span className="font-medium">{page}</span> ページ目を表示
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">First</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* ページ番号 */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // 現在のページの周辺のページ番号を表示
                      let pageNum;
                      if (totalPages <= 5) {
                        // 5ページ以下の場合はすべて表示
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        // 現在のページが前方の場合
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        // 現在のページが後方の場合
                        pageNum = totalPages - 4 + i;
                      } else {
                        // 現在のページが中央の場合
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Last</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}