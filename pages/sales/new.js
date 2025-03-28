// pages/sales/new.js
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SaleForm from '../../components/SaleForm';

export default function NewSale() {
  const router = useRouter();
  
  // 成功時の処理
  const handleSuccess = () => {
    // ダッシュボードにリダイレクト
    router.push('/');
  };
  
  // キャンセル時の処理
  const handleCancel = () => {
    router.push('/');
  };
  
  return (
    <Layout title="新規売上登録 - 売上管理システム">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">新規売上登録</h1>
      </div>
      
      <SaleForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </Layout>
  );
}