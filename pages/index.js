import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import SummaryCard from '../components/SummaryCard';
import { supabase } from '../utils/supabase';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import CompleteSaleButton from '../components/CompleteSaleButton';

// Chart.jsコンポーネントの登録
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Dashboard() {
  // ダッシュボードのデータ状態
  const [monthlySales, setMonthlySales] = useState(0);
  const [monthlyOutsourceCost, setMonthlyOutsourceCost] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [recentSales, setRecentSales] = useState([]);
  const [salesByMonth, setSalesByMonth] = useState([]);
  const [inProgressSales, setInProgressSales] = useState([]); // 進行中の案件
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState('');

  // データ取得
  useEffect(() => {
    fetchDashboardData();
    fetchInProgressSales(); // 進行中の案件を取得
  }, [year]);
  
  // 納期超過の判定
  const isOverdue = (deliveryDate) => {
    if (!deliveryDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const delivery = new Date(deliveryDate);
    return delivery < today;
  };
  
  // 売上完了時のコールバック関数
  const handleSaleComplete = (saleId) => {
    // 成功メッセージを表示
    setUpdateSuccessMessage('案件を完了としてマークしました');
    setTimeout(() => setUpdateSuccessMessage(''), 3000);
    
    // 進行中の案件リストを更新
    fetchInProgressSales();
  };
  
  // 進行中の案件取得
  async function fetchInProgressSales() {
    try {
      const { data, error } = await supabase
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
        `)
        .eq('sale_status', '進行中')
        .order('delivery_date', { ascending: true });
        
      if (error) throw error;
      
      setInProgressSales(data || []);
    } catch (err) {
      console.error('Error fetching in-progress sales:', err);
    }
  }
  
  async function fetchDashboardData() {
    setIsLoading(true);
    setError(null);
    
    try {
      // 今月の日付範囲を計算
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
      
      // 今月の売上データを取得
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('sales')
        .select('id, total_amount')
        .gte('sale_date', firstDayOfMonth)
        .lte('sale_date', lastDayOfMonth);
        
      if (monthlyError) throw monthlyError;
      
      // 今月の売上を集計
      const monthlyTotalSales = monthlyData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
      setMonthlySales(monthlyTotalSales);
      
      // 今月の売上IDを取得
      const saleIds = monthlyData?.map(sale => sale.id) || [];
      
      // 今月の外注コストを取得
      const { data: costData, error: costError } = await supabase
        .from('outsource_costs')
        .select('amount')
        .in('sale_id', saleIds);
        
      if (costError) throw costError;
      
      // 外注コストを集計
      const totalOutsourceCost = costData?.reduce((sum, cost) => sum + (cost.amount || 0), 0) || 0;
      setMonthlyOutsourceCost(totalOutsourceCost);
      
      // 利益 = 売上 - 外注費
      const profit = monthlyTotalSales - totalOutsourceCost;
      setMonthlyProfit(profit);
      
      // 最近の売上を取得
      const { data: recentData, error: recentError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          total_amount,
          sale_status,
          customer:customer_id(id, name),
          user:user_id(id, name),
          sale_type:sale_type_id(id, name)
        `)
        .order('sale_date', { ascending: false })
        .limit(5);
        
      if (recentError) throw recentError;
      
      // 外注コスト情報を追加
      const recentSaleIds = recentData?.map(sale => sale.id) || [];
      let saleOutsourceCosts = {};
      
      if (recentSaleIds.length > 0) {
        const { data: recentCostData, error: recentCostError } = await supabase
          .from('outsource_costs')
          .select(`
            sale_id,
            outsource:outsource_id(id, name),
            amount
          `)
          .in('sale_id', recentSaleIds);
          
        if (recentCostError) throw recentCostError;
        
        // 売上IDごとに外注コストをグループ化
        recentCostData?.forEach(cost => {
          const saleId = cost.sale_id;
          if (!saleOutsourceCosts[saleId]) {
            saleOutsourceCosts[saleId] = [];
          }
          saleOutsourceCosts[saleId].push({
            outsourceName: cost.outsource.name,
            amount: cost.amount
          });
        });
      }
      
      // 最近の売上データを整形
      const formattedRecentSales = recentData?.map(sale => {
        // 該当する売上の外注コスト合計を計算
        const saleOutsourceCost = saleOutsourceCosts[sale.id]?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
        
        return {
          id: sale.id,
          date: sale.sale_date,
          customerName: sale.customer?.name || '',
          outsourceNames: saleOutsourceCosts[sale.id]?.map(cost => cost.outsourceName) || [],
          totalAmount: sale.total_amount || 0,
          outsourceCost: saleOutsourceCost,
          profit: (sale.total_amount || 0) - saleOutsourceCost,
          status: sale.sale_status || '',
          saleType: sale.sale_type?.name || '未分類'
        };
      }) || [];
      
      setRecentSales(formattedRecentSales);
      
      // 月次売上データを取得
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      
      const { data: yearlyData, error: yearlyError } = await supabase
        .from('sales')
        .select('id, sale_date, total_amount')
        .gte('sale_date', startOfYear)
        .lte('sale_date', endOfYear);
        
      if (yearlyError) throw yearlyError;
      
      // 年間の外注コストを取得
      const yearSaleIds = yearlyData?.map(sale => sale.id) || [];
      let yearlyCosts = {};
      
      if (yearSaleIds.length > 0) {
        const { data: yearCostData, error: yearCostError } = await supabase
          .from('outsource_costs')
          .select('sale_id, amount')
          .in('sale_id', yearSaleIds);
          
        if (yearCostError) throw yearCostError;
        
        // 売上IDごとに外注コストをマッピング
        yearCostData?.forEach(cost => {
          yearlyCosts[cost.sale_id] = (yearlyCosts[cost.sale_id] || 0) + cost.amount;
        });
      }
      
      // 月ごとに集計
      const monthlySummary = Array(12).fill().map(() => ({ sales: 0, outsourceCost: 0, profit: 0 }));
      
      yearlyData?.forEach(sale => {
        const month = new Date(sale.sale_date).getMonth();
        monthlySummary[month].sales += sale.total_amount || 0;
        monthlySummary[month].outsourceCost += yearlyCosts[sale.id] || 0;
      });
      
      // 利益を計算
      monthlySummary.forEach(month => {
        month.profit = month.sales - month.outsourceCost;
      });
      
      // 月次データをフォーマット
      const formattedMonthlySales = monthlySummary.map((data, index) => ({
        month: index + 1,
        sales: data.sales,
        outsourceCost: data.outsourceCost,
        profit: data.profit
      }));
      
      setSalesByMonth(formattedMonthlySales);
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* 成功メッセージ */}
        {updateSuccessMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {updateSuccessMessage}
          </div>
        )}
        
        {/* 上部サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SummaryCard
            title="今月の売上"
            value={`¥${monthlySales.toLocaleString()}`}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="bg-green-100 text-green-500"
          />
          <SummaryCard
            title="今月の外注費"
            value={`¥${monthlyOutsourceCost.toLocaleString()}`}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            color="bg-blue-100 text-blue-500"
          />
          <SummaryCard
            title="今月の利益"
            value={`¥${monthlyProfit.toLocaleString()}`}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            color="bg-purple-100 text-purple-500"
          />
        </div>
        
        {/* 月次売上推移グラフ */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">月次推移 ({year}年)</h2>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="2024">2024年</option>
              <option value="2025">2025年</option>
            </select>
          </div>
          
          <div className="h-80">
            {salesByMonth.length > 0 && (
              <Bar
                data={{
                  labels: salesByMonth.map(item => `${item.month}月`),
                  datasets: [
                    {
                      label: '売上',
                      data: salesByMonth.map(item => item.sales),
                      backgroundColor: 'rgba(75, 192, 192, 0.2)',
                      borderColor: 'rgba(75, 192, 192, 1)',
                      borderWidth: 1
                    },
                    {
                      label: '外注費',
                      data: salesByMonth.map(item => item.outsourceCost),
                      backgroundColor: 'rgba(255, 99, 132, 0.2)',
                      borderColor: 'rgba(255, 99, 132, 1)',
                      borderWidth: 1
                    },
                    {
                      label: '利益',
                      data: salesByMonth.map(item => item.profit),
                      backgroundColor: 'rgba(153, 102, 255, 0.2)',
                      borderColor: 'rgba(153, 102, 255, 1)',
                      borderWidth: 1
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return '¥' + value.toLocaleString();
                        }
                      }
                    }
                  }
                }}
              />
            )}
            
            {salesByMonth.length === 0 && !isLoading && (
              <div className="flex items-center justify-center h-full text-gray-500">
                データがありません
              </div>
            )}
            
            {isLoading && (
              <div className="flex items-center justify-center h-full text-gray-500">
                読み込み中...
              </div>
            )}
          </div>
        </div>
        
        {/* 下部コンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 最近の売上 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">最近の売上</h2>
              <Link href="/sales/new" className="text-blue-600 hover:text-blue-800">
                + 新規登録
              </Link>
            </div>
            
            {isLoading && (
              <div className="p-6 text-center text-gray-500">
                読み込み中...
              </div>
            )}
            
            {!isLoading && recentSales.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                売上データがありません
              </div>
            )}
            
            {!isLoading && recentSales.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        日付
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        顧客名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        種類
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        金額
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        外注費
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        進捗
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(sale.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div>
                            {sale.customerName}
                          </div>
                          {sale.outsourceNames.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              外注: {sale.outsourceNames.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {sale.saleType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          ¥{sale.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          ¥{sale.outsourceCost.toLocaleString()}
                          <div className="text-xs text-gray-500">
                            利益: ¥{sale.profit.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span 
                            className={`px-2 py-1 text-xs rounded-full ${
                              sale.status === '完了' ? 'bg-green-100 text-green-800' :
                              sale.status === '進行中' ? 'bg-yellow-100 text-yellow-800' :
                              sale.status === '保留中' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}
                          >
                            {sale.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* 進捗管理ボード */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">進捗管理ボード</h2>
              <Link href="/sales/new" className="text-blue-600 hover:text-blue-800">
                + 新規案件
              </Link>
            </div>
            
            {isLoading && (
              <div className="p-6 text-center text-gray-500">
                読み込み中...
              </div>
            )}
            
            {!isLoading && inProgressSales.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                進行中の案件はありません
              </div>
            )}
            
            {!isLoading && inProgressSales.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        顧客名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        担当者
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        納品日
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        金額
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inProgressSales.map((sale) => (
                      <tr 
                        key={sale.id} 
                        className={`hover:bg-gray-50 ${isOverdue(sale.delivery_date) ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {sale.customer?.name || '不明'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {sale.user_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {sale.delivery_date ? (
                            <span className={isOverdue(sale.delivery_date) ? 'text-red-600 font-medium' : 'text-gray-900'}>
                              {new Date(sale.delivery_date).toLocaleDateString()}
                              {isOverdue(sale.delivery_date) && ' (遅延)'}
                            </span>
                          ) : (
                            <span className="text-gray-500">未設定</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          ¥{sale.total_amount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <Link href="/sales" className="text-blue-600 hover:text-blue-900 mr-4">
                            編集
                          </Link>
                          <CompleteSaleButton saleId={sale.id} onComplete={handleSaleComplete} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        {/* エラーメッセージ */}
        {error && (
          <div className="mt-8 bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
            <p>{error}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}