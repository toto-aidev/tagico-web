import LegalShell, { LegalTable } from '@/components/LegalShell';

export const metadata = {
  title: '外部送信に関する公表事項 | Tagico',
  description: 'Tagicoから外部事業者へ送信される利用者情報について説明します。',
};

const shared = [
  ['Supabase Pte. Ltd.', '通信情報、認証情報、ユーザーID、ログイン時の学習進捗、お問い合わせ、同意後の利用イベント・単語ID・用法ID・正誤', '認証、同期、お問い合わせ受付、同意後の分析・不具合調査'],
  ['Google', '通信情報、Googleアカウントの認証情報・プロフィール情報', '利用者が選択した場合のGoogleログイン'],
  ['Apple', '通信情報、Apple Accountの認証情報', '利用者が選択した場合のSign in with Apple'],
];

const web = [
  ['Vercel', 'IPアドレス、閲覧ページ、参照元、端末・OS・ブラウザ情報等', 'Web版の配信・障害対応。同意後のアクセス分析'],
  ['PostHog', 'ランダム識別子、閲覧ページ、利用イベント、ログイン時のユーザーID、端末・ブラウザ情報', '同意後の継続率・機能利用分析、不具合調査'],
];

export default function ExternalTransmissionPage() {
  return (
    <LegalShell title="外部送信に関する公表事項" description="サービス提供に必要な通信と、任意同意後の利用状況分析を区別して公表します。">
      <p>制定・施行日：2026年7月15日</p>
      <p>Tagicoでは、サービス提供および利用者が同意した分析のため、利用者の端末から運営者または外部事業者へ情報を送信します。</p>

      <h2>iOSアプリ・Web版共通</h2>
      <LegalTable headers={['送信先', '送信する情報', 'Tagicoでの目的']} rows={shared} />

      <h2>iOSアプリ</h2>
      <LegalTable
        headers={['送信先', '送信する情報', 'Tagicoでの目的']}
        rows={[[
          'Apple',
          'Apple Account、商品ID、購入・取引・復元に必要な情報、端末・通信情報',
          'Tagico Proの決済、購入確認、機能解放、復元',
        ]]}
      />

      <h2>Web版</h2>
      <LegalTable headers={['送信先', '送信する情報', 'Tagicoでの目的']} rows={web} />

      <h2>選択方法</h2>
      <ul>
        <li>ログイン、同期、お問い合わせ、購入等に必要な送信は、その機能を選んだときに行われます。</li>
        <li>利用状況分析は初期状態で無効です。同意しない場合も主要機能を利用できます。</li>
        <li>同意後も、プライバシー設定からいつでも停止できます。</li>
        <li>送信済みデータの削除は、ユーザーIDまたはインストールIDを添えてメールで請求できます。</li>
      </ul>
      <p>各送信先は、それぞれのプライバシーポリシー・契約条件に従って情報を取り扱います。</p>
    </LegalShell>
  );
}
