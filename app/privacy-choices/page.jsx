import LegalShell from '@/components/LegalShell';
import PrivacyChoicesClient from '@/components/PrivacyChoicesClient';

export const metadata = {
  title: 'プライバシー設定・請求 | Tagico',
  description: '利用状況分析の設定、データ開示・削除、アカウント削除の方法です。',
};

export default function PrivacyChoicesPage() {
  return (
    <LegalShell title="プライバシー設定・請求" description="分析への同意は任意です。主要な学習機能は、同意しなくても利用できます。">
      <PrivacyChoicesClient />

      <h2>iOSアプリで変更する</h2>
      <p>「設定」→「プライバシー」→「利用状況データを送信」で、いつでも有効・無効を切り替えられます。無効にすると、新しい利用状況データの作成・送信を停止し、未送信のキューを破棄します。</p>

      <h2>アカウントを削除する</h2>
      <p>iOSアプリの「設定」→「アカウント」→「アカウントを削除」から実行できます。クラウド上の情報を削除し、端末内の学習履歴は残します。</p>
      <p>Web版のみを利用していてアプリから操作できない場合は、登録メールアドレスから下記窓口へ削除を請求してください。本人確認後に対応します。</p>

      <h2>送信済みデータの開示・訂正・削除</h2>
      <p>
        <a href="mailto:kaifa.toto@gmail.com">kaifa.toto@gmail.com</a> へ、希望する手続と、ユーザーIDまたはインストールIDをお送りください。本人確認に必要な最小限の情報をお願いする場合があります。原則14日以内を目安に回答します。
      </p>
      <p>パスワード、決済情報、本人確認書類の画像は送らないでください。</p>

      <h2>同意を撤回した場合</h2>
      <p>撤回後の操作は分析用に送信されません。撤回前に適法に取得したデータは保存期限まで保持されますが、上記窓口から削除を請求できます。</p>
    </LegalShell>
  );
}
