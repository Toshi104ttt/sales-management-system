import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../utils/supabase';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';

// Chart.jsコンポーネントの登録
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend
);

export default function MonthlyReport() {
  // フィルター用の状態
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  
  // データ用の状態
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState({
    totalSales: 0,
    totalOutsourceCost: 0,
    totalProfit: 0, // 売上 - 外注費
    salesCount: 0
  });
  
  // グラフデータ用の状態
  const [dailySales, setDailySales] = useState([]);
  const [typeBreakdown, setTypeBreakdown] = useState([]);
  const [customerBreakdown, setCustomerBreakdown] = useState([]);
  const [yearlyTrend, setYearlyTrend] = useState([]);
  const [outsourceCosts, setOutsourceCosts] = useState([]);
  
  // 年月の選択肢
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear; y++) {
    yearOptions.push(y);
  }
  
  // データ取得
  useEffect(() => {
    fetchMonthlyData();
    fetchYearlyTrend();
  }, [year, month]);
  
  // 指定年月のデータ取得
  async function fetchMonthlyData() {
    setIsLoading(true);
    setError(null);
    
    try {
      // 月初と月末を計算
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      
      // 指定月の売上データを取得
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          total_amount,
          sale_status,
          customer:customer_id(id, name),
          sale_type:sale_type_id(id, name)
        `)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date');
        
      if (salesError) throw salesError;
      
      // 外注コスト情報を取得
      let totalOutsourceCost = 0;
      const outsourceCostsByCompany = {};
      const saleOutsourceCosts = {}; // 売上IDごとの外注コスト
      
      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(sale => sale.id);
        
        const { data: costsData, error: costsError } = await supabase
          .from('outsource_costs')
          .select(`
            id,
            amount,
            outsource:outsource_id(id, name),
            sale_id
          `)
          .in('sale_id', saleIds);
          
        if (costsError) throw costsError;
        
        if (costsData && costsData.length > 0) {
          // 総コスト集計
          totalOutsourceCost = costsData.reduce((sum, cost) => sum + (cost.amount || 0), 0);
          
          // 外注先ごとのコスト集計
          costsData.forEach(cost => {
            const companyName = cost.outsource?.name || '不明';
            if (!outsourceCostsByCompany[companyName]) {
              outsourceCostsByCompany[companyName] = 0;
            }
            outsourceCostsByCompany[companyName] += cost.amount || 0;
            
            // 売上IDごとの外注コスト集計
            const saleId = cost.sale_id;
            if (!saleOutsourceCosts[saleId]) {
              saleOutsourceCosts[saleId] = 0;
            }
            saleOutsourceCosts[saleId] += cost.amount || 0;
          });
        }
      }
      
      // 月間サマリー集計
      const totalSales = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
      const salesCount = salesData?.length || 0;
      
      // 利益 = 売上 - 外注費
      const totalProfit = totalSales - totalOutsourceCost;
        
      setMonthlySummary({
        totalSales,
        totalOutsourceCost,
        totalProfit,
        salesCount
      });
      
      // 日次売上データ作成
      const dailyData = {};
      const dailyOutsourceCosts = {}; // 日付ごとの外注コスト
      
      // 月の各日を初期化
      for (let day = 1; day <= lastDay; day++) {
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dailyData[dateString] = { sales: 0, outsourceCost: 0 };
      }
      
      // 売上データを集計
      salesData?.forEach(sale => {
        const dateString = sale.sale_date.split('T')[0];
        if (dailyData[dateString]) {
          dailyData[dateString].sales += sale.total_amount || 0;
          dailyData[dateString].outsourceCost += saleOutsourceCosts[sale.id] || 0;
        }
      });
      
      // グラフ用に整形 (利益 = 売上 - 外注費)
      const dailySalesData = Object.entries(dailyData).map(([date, data]) => ({
        date,
        day: new Date(date).getDate(),
        sales: data.sales,
        outsourceCost: data.outsourceCost,
        profit: data.sales - data.outsourceCost
      }));
      
      setDailySales(dailySalesData);
      
      // 売上種類ごとの内訳
      const typeData = {};
      salesData?.forEach(sale => {
        const typeName = sale.sale_type?.name || '未分類';
        if (!typeData[typeName]) {
          typeData[typeName] = 0;
        }
        typeData[typeName] += sale.total_amount || 0;
      });
      
      // グラフ用に整形
      const typeBreakdownData = Object.entries(typeData).map(([name, amount]) => ({
        name,
        amount
      }));
      
      setTypeBreakdown(typeBreakdownData);
      
      // 顧客ごとの内訳
      const customerData = {};
      salesData?.forEach(sale => {
        const customerName = sale.customer?.name || '不明';
        if (!customerData[customerName]) {
          customerData[customerName] = 0;
        }
        customerData[customerName] += sale.total_amount || 0;
      });
      
      // グラフ用に整形（上位5件）
      const customerBreakdownData = Object.entries(customerData)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
        
      setCustomerBreakdown(customerBreakdownData);
      
      // 外注コスト内訳
      const outsourceCostsData = Object.entries(outsourceCostsByCompany)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
        
      setOutsourceCosts(outsourceCostsData);
    } catch (err) {
      console.error('Error fetching monthly data:', err);
      setError('月次データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }
  
  // 年間トレンドデータ取得
  async function fetchYearlyTrend() {
    try {
      // 年の開始と終了を計算
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      // 年間の売上データを取得
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, sale_date, total_amount')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);
        
      if (salesError) throw salesError;
      
      // 外注コストを取得
      const { data: costsData, error: costsError } = await supabase
        .from('outsource_costs')
        .select('amount, sale_id');
        
      if (costsError) throw costsError;
      
      // 売上IDごとの外注コストをマッピング
      const costBySaleId = {};
      costsData?.forEach(cost => {
        if (!costBySaleId[cost.sale_id]) {
          costBySaleId[cost.sale_id] = 0;
        }
        costBySaleId[cost.sale_id] += cost.amount || 0;
      });
      
      // 月ごとのデータを初期化
      const monthlyData = Array(12).fill().map(() => ({ sales: 0, outsourceCost: 0 }));
      
      // 月ごとに集計
      salesData?.forEach(sale => {
        const saleMonth = new Date(sale.sale_date).getMonth();
        monthlyData[saleMonth].sales += sale.total_amount || 0;
        monthlyData[saleMonth].outsourceCost += costBySaleId[sale.id] || 0;
      });
      
      // 月名を設定
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      
      // グラフ用に整形 (利益 = 売上 - 外注費)
      const yearlyTrendData = monthlyData.map((data, index) => ({
        month: monthNames[index],
        monthNumber: index + 1,
        sales: data.sales,
        outsourceCost: data.outsourceCost,
        profit: data.sales - data.outsourceCost
      }));
      
      setYearlyTrend(yearlyTrendData);
    } catch (err) {
      console.error('Error fetching yearly trend:', err);
    }
  }
  
  // グラフカラーの設定
  const chartColors = {
    sales: 'rgba(75, 192, 192, 0.6)',
    salesBorder: 'rgba(75, 192, 192, 1)',
    cost: 'rgba(255, 99, 132, 0.6)',
    costBorder: 'rgba(255, 99, 132, 1)',
    profit: 'rgba(153, 102, 255, 0.6)',
    profitBorder: 'rgba(153, 102, 255, 1)',
    pieColors: [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(199, 199, 199, 0.6)'
    ]
  };
  
  return (
    <Layout title="月次レポート">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">月次レポート</h1>
          
          {/* 年月選択 */}
          <div className="flex space-x-2">
            <select
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select
              value={month}
              onChange={e => setMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <svg className="animate-spin h-8 w-8 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          <>
            {/* 月間サマリーカード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">月間売上</h2>
                <p className="mt-2 text-3xl font-semibold text-gray-900">¥{monthlySummary.totalSales.toLocaleString()}</p>
                <p className="mt-1 text-sm text-gray-500">取引件数: {monthlySummary.salesCount}件</p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">外注費</h2>
                <p className="mt-2 text-3xl font-semibold text-gray-900">¥{monthlySummary.totalOutsourceCost.toLocaleString()}</p>
                <p className="mt-1 text-sm text-gray-500">
                  売上に対する比率: {(monthlySummary.totalSales > 0 ? (monthlySummary.totalOutsourceCost / monthlySummary.totalSales * 100) : 0).toFixed(1)}%
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">利益（売上 - 外注費）</h2>
                <p className="mt-2 text-3xl font-semibold text-gray-900">¥{monthlySummary.totalProfit.toLocaleString()}</p>
                <p className="mt-1 text-sm text-gray-500">
                  売上に対する比率: {(monthlySummary.totalSales > 0 ? (monthlySummary.totalProfit / monthlySummary.totalSales * 100) : 0).toFixed(1)}%
                </p>
              </div>
            </div>
            
            {/* 年間トレンドグラフ */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">{year}年 月次売上・外注費・利益推移</h2>
              <div className="h-80">
                <Line
                  data={{
                    labels: yearlyTrend.map(item => item.month),
                    datasets: [
                      {
                        label: '売上',
                        data: yearlyTrend.map(item => item.sales),
                        backgroundColor: chartColors.sales,
                        borderColor: chartColors.salesBorder,
                        borderWidth: 2,
                        tension: 0.1
                      },
                      {
                        label: '外注費',
                        data: yearlyTrend.map(item => item.outsourceCost),
                        backgroundColor: chartColors.cost,
                        borderColor: chartColors.costBorder,
                        borderWidth: 2,
                        tension: 0.1
                      },
                      {
                        label: '利益',
                        data: yearlyTrend.map(item => item.profit),
                        backgroundColor: chartColors.profit,
                        borderColor: chartColors.profitBorder,
                        borderWidth: 2,
                        tension: 0.1
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
                    },
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return context.dataset.label + ': ¥' + context.parsed.y.toLocaleString();
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            {/* 日次売上グラフ */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">{year}年{month}月 日次売上・外注費・利益</h2>
              <div className="h-80">
                <Bar
                  data={{
                    labels: dailySales.map(item => item.day),
                    datasets: [
                      {
                        label: '売上',
                        data: dailySales.map(item => item.sales),
                        backgroundColor: chartColors.sales,
                        borderColor: chartColors.salesBorder,
                        borderWidth: 1
                      },
                      {
                        label: '外注費',
                        data: dailySales.map(item => item.outsourceCost),
                        backgroundColor: chartColors.cost,
                        borderColor: chartColors.costBorder,
                        borderWidth: 1
                      },
                      {
                        label: '利益',
                        data: dailySales.map(item => item.profit),
                        backgroundColor: chartColors.profit,
                        borderColor: chartColors.profitBorder,
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
                      },
                      x: {
                        title: {
                          display: true,
                          text: '日'
                        }
                      }
                    },
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return context.dataset.label + ': ¥' + context.parsed.y.toLocaleString();
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            {/* 内訳グラフ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* 売上種類内訳 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">売上種類内訳</h2>
                {typeBreakdown.length > 0 ? (
                  <div className="h-80 flex items-center justify-center">
                    <Pie
                      data={{
                        labels: typeBreakdown.map(item => item.name),
                        datasets: [
                          {
                            data: typeBreakdown.map(item => item.amount),
                            backgroundColor: chartColors.pieColors,
                            borderWidth: 1
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ¥${value.toLocaleString()} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    データがありません
                  </div>
                )}
              </div>
              
              {/* 顧客別売上 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">顧客別売上 (上位5件)</h2>
                {customerBreakdown.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: customerBreakdown.map(item => item.name),
                        datasets: [
                          {
                            label: '売上',
                            data: customerBreakdown.map(item => item.amount),
                            backgroundColor: chartColors.pieColors,
                            borderWidth: 1
                          }
                        ]
                      }}
                      options={{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return '売上: ¥' + context.parsed.x.toLocaleString();
                              }
                            }
                          }
                        },
                        scales: {
                          x: {
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
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    データがありません
                  </div>
                )}
              </div>
            </div>
            
            {/* 外注コスト内訳 */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">外注費内訳</h2>
              {outsourceCosts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          外注先
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          費用
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          比率
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {outsourceCosts.map((cost, index) => {
                        const percentage = monthlySummary.totalOutsourceCost > 0
                          ? (cost.amount / monthlySummary.totalOutsourceCost * 100).toFixed(1)
                          : 0;
                          
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {cost.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              ¥{cost.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {percentage}%
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 font-medium">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          合計
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          ¥{monthlySummary.totalOutsourceCost.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          100%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  外注費データがありません
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}