export default function handler(req, res) {
    // POSTリクエストのみ受け付ける
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
  
    const { username, password } = req.body;
    
    // 固定のユーザー名とパスワード
    // 本番では環境変数などから読み込むとよいでしょう
    const validUsername = 'Toshi';
    const validPassword = '2414';
    
    if (username === validUsername && password === validPassword) {
      // 認証成功
      res.status(200).json({ success: true });
    } else {
      // 認証失敗
      res.status(401).json({ success: false, message: 'ユーザー名またはパスワードが違います' });
    }
  }