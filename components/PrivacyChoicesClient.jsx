'use client';

import { usePrivacyConsent } from '@/components/PrivacyConsentProvider';

export default function PrivacyChoicesClient() {
  const consent = usePrivacyConsent();

  if (consent.status === 'loading') {
    return <p>現在の設定を確認しています。</p>;
  }

  return (
    <section className="mb-8 rounded-2xl border border-teal-100 bg-teal-50 p-5">
      <p className="text-sm font-black text-slate-900">
        Web版の現在の設定：{consent.isAllowed ? '送信する' : '送信しない'}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        利用状況分析にはVercel Web AnalyticsとPostHogを使用します。広告目的の追跡や画面録画は行いません。
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={consent.deny}
          aria-pressed={!consent.isAllowed}
          className={`rounded-xl px-4 py-2 text-sm font-black ${!consent.isAllowed ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
        >
          送信しない
        </button>
        <button
          type="button"
          onClick={consent.allow}
          aria-pressed={consent.isAllowed}
          className={`rounded-xl px-4 py-2 text-sm font-black ${consent.isAllowed ? 'bg-teal-600 text-white' : 'bg-white text-teal-700'}`}
        >
          同意する
        </button>
      </div>
    </section>
  );
}
