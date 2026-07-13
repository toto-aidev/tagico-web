import Link from 'next/link';

const legalLinks = [
  ['/legal/privacy', 'プライバシーポリシー'],
  ['/legal/terms', '利用規約'],
  ['/legal/commercial-transactions', '特定商取引法に基づく表記'],
  ['/legal/external-transmission', '外部送信'],
  ['/legal/notices', 'ライセンス・商標'],
  ['/privacy-choices', 'プライバシー設定'],
  ['/support', 'サポート'],
];

export default function LegalShell({ title, description, updated = '2026年7月15日', children }) {
  return (
    <div className="legal-page min-h-screen bg-slate-50 text-slate-700">
      <header className="border-b border-teal-100 bg-white/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="text-xl font-black tracking-tight text-slate-900">
            Tagico
          </Link>
          <Link href="/" className="rounded-full bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">
            学習画面へ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-600">Tagico</p>
          <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">{title}</h1>
          {description ? <p className="mt-4 max-w-2xl leading-7 text-slate-600">{description}</p> : null}
          <p className="mt-3 text-sm text-slate-400">最終更新：{updated}</p>
        </div>

        <article className="legal-article rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          {children}
        </article>

        <nav aria-label="法務・サポート" className="mt-8 flex flex-wrap gap-2">
          {legalLinks.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
            >
              {label}
            </Link>
          ))}
        </nav>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-xs text-slate-400">
        © 2026 于潤輝 / Tagico
      </footer>
    </div>
  );
}

export function LegalTable({ headers, rows }) {
  return (
    <div className="my-5 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-slate-200 px-4 py-3 font-black">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="align-top odd:bg-white even:bg-slate-50/50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-slate-100 px-4 py-3 leading-6 last:border-b-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
