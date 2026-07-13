'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Analytics } from '@vercel/analytics/next';
import { captureEvent, disablePostHog, enablePostHog } from '@/lib/posthog';

export const ANALYTICS_CONSENT_KEY = 'tagico.analytics.consent-v1';

const PrivacyConsentContext = createContext(null);

export function usePrivacyConsent() {
  const value = useContext(PrivacyConsentContext);
  if (!value) {
    throw new Error('usePrivacyConsent must be used inside PrivacyConsentProvider');
  }
  return value;
}
export default function PrivacyConsentProvider({ children }) {
  const pathname = usePathname();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let saved = 'undecided';
    try {
      const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      if (raw === 'allowed' || raw === 'denied') saved = raw;
    } catch (_) {}

    setStatus(saved);
    if (saved === 'allowed') {
      enablePostHog();
    } else {
      disablePostHog();
    }
  }, []);

  const choose = (nextStatus) => {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, nextStatus);
    } catch (_) {}
    setStatus(nextStatus);

    if (nextStatus === 'allowed') {
      enablePostHog();
      captureEvent('analytics_consent_granted');
    } else {
      disablePostHog();
    }
  };

  const value = useMemo(
    () => ({
      status,
      isAllowed: status === 'allowed',
      hasChosen: status === 'allowed' || status === 'denied',
      allow: () => choose('allowed'),
      deny: () => choose('denied'),
    }),
    [status]
  );

  const showPrompt = pathname === '/' && status === 'undecided';

  return (
    <PrivacyConsentContext.Provider value={value}>
      {children}
      {status === 'allowed' ? <Analytics /> : null}
      {showPrompt ? <PrivacyConsentPrompt onAllow={value.allow} onDeny={value.deny} /> : null}
    </PrivacyConsentContext.Provider>
  );
}

function PrivacyConsentPrompt({ onAllow, onDeny }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="privacy-consent-title">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.22)]">
        <h2 id="privacy-consent-title" className="text-base font-black text-slate-900">利用状況データの送信</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          単語・用法ごとの正答率などを、Tagicoの改善に役立ててもよいですか？ 同意は任意で、あとから変更できます。
        </p>
        <Link href="/legal/privacy" className="mt-2 inline-block text-xs font-bold text-teal-700 underline underline-offset-2">
          取得内容を確認
        </Link>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onDeny} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600">
            送信しない
          </button>
          <button type="button" onClick={onAllow} className="rounded-2xl bg-teal-500 px-4 py-3 text-sm font-black text-white shadow-sm">
            同意する
          </button>
        </div>
      </div>
    </div>
  );
}
