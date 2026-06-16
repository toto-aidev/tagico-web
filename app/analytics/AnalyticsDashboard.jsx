'use client';

// app/analytics/AnalyticsDashboard.jsx — ダッシュボード本体（Client Component）
// ダミーデータのみ。外部 fetch なし。チャートは自前 SVG。

import React from 'react';

// ─── ブランドモチーフ（Home.jsx の TagMark / TagicoLogo を簡略コピー） ────────────
const TAG_PATH =
  'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z';

function TagMark({ size = 26, front = '#ffffff', back = 'rgba(255,255,255,0.38)', hole = '#2DD4BF' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="rotate(16 12 12) translate(1.4 -1)">
        <path d={TAG_PATH} fill={back} />
      </g>
      <g transform="rotate(-7 12 12)">
        <path d={TAG_PATH} fill={front} />
        <circle cx="7.2" cy="7.2" r="1.55" fill={hole} />
      </g>
    </svg>
  );
}

function DashboardLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 rounded-2xl rotate-3 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-teal-400 to-teal-500 shadow-lg shadow-teal-500/30">
          <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20 pointer-events-none" />
          <TagMark size={26} hole="#2BC0AE" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-rose-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
          <svg width="7" height="7" viewBox="0 0 10 10" fill="#fff" aria-hidden="true">
            <path d="M5 0 C5.4 3 5.8 3.6 10 5 C5.8 6.4 5.4 7 5 10 C4.6 7 4.2 6.4 0 5 C4.2 3.6 4.6 3 5 0 Z" />
          </svg>
        </div>
      </div>
      <div>
        <div className="flex items-baseline tracking-tighter">
          <span className="text-2xl font-black text-slate-800">Tag</span>
          <span className="text-2xl font-black text-teal-500">ico</span>
          <span className="ml-2 text-base font-black text-slate-600">改善ダッシュボード</span>
        </div>
        <p className="text-[0.6rem] font-bold tracking-[0.2em] text-slate-400 uppercase mt-0.5">Polyseme Quest · Analytics</p>
      </div>
    </div>
  );
}

// ─── ダミーデータ ────────────────────────────────────────────────────────────────

const KPI_DATA = [
  { label: '累計ユーザー', value: '1,284', unit: '人', delta: '+38', up: true, icon: '👥' },
  { label: '今日のアクティブ', value: '47', unit: '人', delta: '+12', up: true, icon: '⚡' },
  { label: 'クイズ完了数', value: '8,431', unit: '回', delta: '+203', up: true, icon: '🎯' },
  { label: '平均初回正答率', value: '61', unit: '%', delta: '-2', up: false, icon: '🧠' },
];

// (a) 単語別初回正答率（低い順）
const WORD_ACCURACY = [
  { word: 'fair',    pct: 32, n: 142 },
  { word: 'fine',    pct: 38, n: 128 },
  { word: 'mean',    pct: 44, n: 156 },
  { word: 'odd',     pct: 49, n: 97  },
  { word: 'just',    pct: 55, n: 184 },
  { word: 'still',   pct: 63, n: 121 },
  { word: 'get',     pct: 71, n: 210 },
  { word: 'while',   pct: 78, n: 168 },
  { word: 'as',      pct: 83, n: 195 },
  { word: 'have',    pct: 88, n: 203 },
];

// (b) リテンション（D1/D3/D7/D14/D30）
const RETENTION = [
  { label: 'D1',  pct: 45 },
  { label: 'D3',  pct: 28 },
  { label: 'D7',  pct: 19 },
  { label: 'D14', pct: 12 },
  { label: 'D30', pct: 8  },
];

// (c) 到達レベル分布
const LEVEL_DIST = [
  { lv: 'Lv 1', count: 120 },
  { lv: 'Lv 2', count: 78  },
  { lv: 'Lv 3', count: 41  },
  { lv: 'Lv 4', count: 22  },
  { lv: 'Lv 5', count: 9   },
];

// (d) 直近14日間の日次データ
const DAILY_14 = [
  { day: '06/03', dau: 8,  quiz: 31  },
  { day: '06/04', dau: 11, quiz: 44  },
  { day: '06/05', dau: 9,  quiz: 38  },
  { day: '06/06', dau: 14, quiz: 52  },
  { day: '06/07', dau: 12, quiz: 49  },
  { day: '06/08', dau: 7,  quiz: 27  },
  { day: '06/09', dau: 6,  quiz: 24  },
  { day: '06/10', dau: 15, quiz: 61  },
  { day: '06/11', dau: 18, quiz: 73  },
  { day: '06/12', dau: 13, quiz: 50  },
  { day: '06/13', dau: 21, quiz: 88  },
  { day: '06/14', dau: 17, quiz: 68  },
  { day: '06/15', dau: 23, quiz: 95  },
  { day: '06/16', dau: 47, quiz: 191 },
];

// (e) ログイン方法の内訳
const LOGIN_DIST = [
  { label: '匿名',    pct: 62, color: '#2DD4BF' },
  { label: 'メール',  pct: 24, color: '#f59e0b'  },
  { label: 'Google',  pct: 14, color: '#fb7185'  },
];

// ─── ユーティリティ ──────────────────────────────────────────────────────────────

function barColor(pct) {
  if (pct < 50) return '#fb7185'; // rose-400
  if (pct < 70) return '#fbbf24'; // amber-400
  return '#2DD4BF'; // teal-400
}

// ─── チャートコンポーネント ──────────────────────────────────────────────────────

// (a) 横棒チャート
function HorizontalBarChart({ items }) {
  const maxPct = 100;
  const rowH = 38;
  const labelW = 52;
  const svgH = items.length * rowH + 8;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${labelW + 300 + 60} ${svgH}`} className="w-full" aria-label="単語別初回正答率">
        {items.map((item, i) => {
          const y = i * rowH + 4;
          const barW = (item.pct / maxPct) * 260;
          const fill = barColor(item.pct);
          return (
            <g key={item.word}>
              {/* 単語ラベル */}
              <text
                x={labelW - 8}
                y={y + 20}
                textAnchor="end"
                fontSize="13"
                fontFamily="inherit"
                fontWeight="700"
                fill="#475569"
              >
                {item.word}
              </text>
              {/* 背景バー */}
              <rect x={labelW} y={y + 8} width={260} height={20} rx={10} fill="#f1f5f9" />
              {/* 実際のバー */}
              <rect x={labelW} y={y + 8} width={barW} height={20} rx={10} fill={fill} opacity="0.9" />
              {/* % ラベル */}
              <text
                x={labelW + barW + 8}
                y={y + 22}
                fontSize="12"
                fontFamily="inherit"
                fontWeight="800"
                fill={fill}
              >
                {item.pct}%
              </text>
              {/* n= ラベル */}
              <text
                x={labelW + 268 + 8}
                y={y + 22}
                fontSize="11"
                fontFamily="inherit"
                fill="#94a3b8"
              >
                (n={item.n})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// (b) リテンション エリアチャート
function RetentionChart({ items }) {
  // データが1点以下だと折れ線が描けない（i/(length-1) が NaN / pts[0] 参照不可）。ガードは pts 計算より前に置く。
  if (!items || items.length <= 1) {
    return (
      <div className="w-full flex items-center justify-center h-32 text-sm font-bold text-slate-400">
        データ収集中…
      </div>
    );
  }
  const W = 340;
  const H = 160;
  const padL = 36;
  const padR = 16;
  const padT = 20;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const pts = items.map((d, i) => {
    const x = padL + (i / (items.length - 1)) * innerW;
    const y = padT + (1 - d.pct / 100) * innerH;
    return { x, y, ...d };
  });

  const areaPath =
    `M${pts[0].x},${padT + innerH} ` +
    pts.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${padT + innerH} Z`;

  const linePath =
    `M${pts[0].x},${pts[0].y} ` +
    pts.slice(1).map((p) => `L${p.x},${p.y}`).join(' ');

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="継続率チャート">
      {/* Y軸グリッド */}
      {yTicks.map((tick) => {
        const y = padT + (1 - tick / 100) * innerH;
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} fontSize="9" textAnchor="end" fill="#94a3b8" fontFamily="inherit">
              {tick}%
            </text>
          </g>
        );
      })}

      {/* グラデーション定義 */}
      <defs>
        <linearGradient id="tgRetentionGradV1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* エリア */}
      <path d={areaPath} fill="url(#tgRetentionGradV1)" />
      {/* ライン */}
      <path d={linePath} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* データポイントとラベル */}
      {pts.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="5" fill="#14b8a6" stroke="#fff" strokeWidth="2" />
          {/* % ラベル（上） */}
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f766e" fontFamily="inherit">
            {p.pct}%
          </text>
          {/* X軸ラベル */}
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b" fontFamily="inherit">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// (c) 到達レベル分布 縦棒
function LevelDistChart({ items }) {
  const W = 320;
  const H = 180;
  const padL = 40;
  const padR = 12;
  const padT = 24;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxCount = Math.max(...items.map((d) => d.count), 1);
  const barW = innerW / Math.max(items.length, 1);
  const barPad = barW * 0.18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="到達レベル分布">
      {/* Y軸グリッド */}
      {[0, 50, 100, 150].map((tick) => {
        const y = padT + (1 - tick / (maxCount * 1.1)) * innerH;
        if (y < padT) return null;
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} fontSize="9" textAnchor="end" fill="#94a3b8" fontFamily="inherit">
              {tick}
            </text>
          </g>
        );
      })}

      {items.map((item, i) => {
        const x = padL + i * barW + barPad;
        const bw = barW - barPad * 2;
        const bh = (item.count / (maxCount * 1.1)) * innerH;
        const y = padT + innerH - bh;
        const prevCount = i > 0 ? items[i - 1].count : null;
        const retPct = prevCount ? Math.round((item.count / prevCount) * 100) : null;

        return (
          <g key={item.lv}>
            {/* バー */}
            <rect x={x} y={y} width={bw} height={bh} rx={5} fill="#2DD4BF" opacity={1 - i * 0.12} />
            {/* 人数 */}
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f766e" fontFamily="inherit">
              {item.count}
            </text>
            {/* 残存率 */}
            {retPct !== null && (
              <text x={x + bw / 2} y={y - 18} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="inherit">
                ▼{retPct}%
              </text>
            )}
            {/* X軸ラベル */}
            <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b" fontFamily="inherit">
              {item.lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// (d) 日次 DAU + クイズ完了 折れ線
function DailyLineChart({ items }) {
  // データが1点以下だと折れ線が描けない（i/(length-1) が NaN になる）。Cron初日など。
  if (!items || items.length <= 1) {
    return (
      <div className="w-full flex items-center justify-center h-40 text-sm font-bold text-slate-400">
        データ収集中…
      </div>
    );
  }
  const W = 380;
  const H = 180;
  const padL = 34;
  const padR = 12;
  const padT = 24;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // 両系列を同一スケールに統一：DAU・クイズ完了の最大値をまとめて求める
  const maxVal = Math.max(
    Math.max(...items.map((d) => d.dau)),
    Math.max(...items.map((d) => d.quiz)),
    1,
  ) * 1.2;

  const dauPts = items.map((d, i) => ({
    x: padL + (i / (items.length - 1)) * innerW,
    y: padT + (1 - d.dau / maxVal) * innerH,
    dau: d.dau,
    day: d.day,
  }));
  const quizPts = items.map((d, i) => ({
    x: padL + (i / (items.length - 1)) * innerW,
    y: padT + (1 - d.quiz / maxVal) * innerH,
    quiz: d.quiz,
  }));

  const dauLine = `M${dauPts[0].x},${dauPts[0].y} ` + dauPts.slice(1).map((p) => `L${p.x},${p.y}`).join(' ');
  const quizLine = `M${quizPts[0].x},${quizPts[0].y} ` + quizPts.slice(1).map((p) => `L${p.x},${p.y}`).join(' ');

  // X軸：先頭・中間・末尾にラベル表示
  const midIdx = Math.floor((items.length - 1) / 2);
  const lastIdx = items.length - 1;

  return (
    <div>
      {/* 凡例 */}
      <div className="flex items-center gap-4 mb-2 text-xs font-bold">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-teal-400 rounded" />
          <span className="text-teal-600">DAU</span>
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="24" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="8" y2="2" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />
            <line x1="12" y1="2" x2="20" y2="2" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          <span className="text-slate-500">クイズ完了</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="日次アクティブ＆クイズ完了">
        {/* グリッド */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + t * innerH;
          const val = Math.round(maxVal * (1 - t));
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padL - 4} y={y + 4} fontSize="9" textAnchor="end" fill="#94a3b8" fontFamily="inherit">
                {val}
              </text>
            </g>
          );
        })}

        {/* クイズ完了（破線・slate） */}
        <path d={quizLine} fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />

        {/* DAU（実線・teal） */}
        <path d={dauLine} fill="none" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* DAU の点 */}
        {dauPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#14b8a6" stroke="#fff" strokeWidth="1.5" />
        ))}

        {/* X軸ラベル（先頭・中間・末尾のみ） */}
        {items.map((d, i) => {
          if (i !== 0 && i !== midIdx && i !== lastIdx) return null;
          const x = padL + (i / (items.length - 1)) * innerW;
          return (
            <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b" fontFamily="inherit">
              {d.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// (e) ドーナツチャート
// LOGIN_DIST の color は固定値をコンポーネント側で保持する
const DONUT_COLORS = {
  '匿名':   '#2DD4BF',
  'メール': '#f59e0b',
  'Google': '#fb7185',
};

function DonutChart({ items }) {
  const R = 60;
  const CX = 80;
  const CY = 75;
  const total = items.reduce((s, d) => s + d.pct, 0);
  const stroke = 22;

  let cumAngle = -Math.PI / 2; // 上から開始
  const arcs = items.map((item) => {
    const angle = (item.pct / total) * Math.PI * 2;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;

    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const color = item.color ?? DONUT_COLORS[item.label] ?? '#94a3b8';
    return {
      ...item,
      color,
      d: `M${x1},${y1} A${R},${R} 0 ${largeArc},1 ${x2},${y2}`,
    };
  });

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 160 150" className="w-36 shrink-0" aria-label="ログイン方法の内訳">
        {arcs.map((arc) => (
          <path
            key={arc.label}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            opacity="0.92"
          />
        ))}
        {/* 中央テキスト */}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="20" fontWeight="900" fill="#1e293b" fontFamily="inherit">
          {total}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8" fontFamily="inherit">
          合計 %
        </text>
      </svg>

      {/* 凡例 */}
      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const color = item.color ?? DONUT_COLORS[item.label] ?? '#94a3b8';
          return (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-bold text-slate-600">{item.label}</span>
              <span className="text-sm font-black" style={{ color }}>{item.pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── カードラッパー ──────────────────────────────────────────────────────────────

function Card({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 tg-fadeup ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className="text-sm font-black text-slate-700 tracking-tight">{title}</h2>}
          {subtitle && <p className="text-xs font-bold text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── KPI ミニカード ───────────────────────────────────────────────────────────────

// delta が null/undefined の場合はバッジを非表示にする（実データ未取得時）
function KpiCard({ label, value, unit, delta, up, icon }) {
  const hasDelta = delta !== null && delta !== undefined;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 tg-fadeup">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xl">{icon}</span>
        {hasDelta && (
          <span
            className={`text-xs font-black px-1.5 py-0.5 rounded-full ${
              up ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-500'
            }`}
          >
            {up ? '▲' : '▼'} {String(delta).replace(/[+-]/, '')}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-slate-800">{value}</span>
        <span className="text-sm font-bold text-slate-400">{unit}</span>
      </div>
      <p className="text-xs font-bold text-slate-500 mt-1">{label}</p>
    </div>
  );
}

// ─── JST 日時フォーマット ──────────────────────────────────────────────────────────

function toJST(isoStr) {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return isoStr;
  }
}

// ─── メインダッシュボード ─────────────────────────────────────────────────────────
//
// data: AnalyticsGate から渡される実スナップショット payload。
//        null の場合（鍵未設定 / 未ログイン / Cron 未実行 など）はダミー定数にフォールバック。
//        data の各 slice が空配列の場合も同様にフォールバック。

export default function AnalyticsDashboard({ data }) {
  const isReal = !!data;

  // 各データ slice を data から取得し、空/未定義なら対応するダミー定数にフォールバック
  const kpiData = isReal ? buildKpiData(data.kpi) : KPI_DATA;
  const wordAccuracy = (isReal && data.wordAccuracy?.length > 0) ? data.wordAccuracy : WORD_ACCURACY;
  const retention    = (isReal && data.retention?.length    > 0) ? data.retention    : RETENTION;
  const levelDist    = (isReal && data.levelDist?.length    > 0) ? data.levelDist    : LEVEL_DIST;
  const daily14      = (isReal && data.daily14?.length      > 0) ? data.daily14      : DAILY_14;
  const loginDist    = (isReal && data.loginDist?.length    > 0) ? data.loginDist    : LOGIN_DIST;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 背景ぼかし */}
      <div className="fixed top-[-8%] left-[-8%] w-72 h-72 bg-teal-200/25 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="fixed top-[30%] right-[-8%] w-56 h-56 bg-rose-200/20 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="relative z-10 max-w-md lg:max-w-[980px] w-full mx-auto px-4 pt-10 pb-16 lg:shadow-[0_10px_60px_rgba(15,23,42,0.08)]">

        {/* ── ヘッダー ── */}
        <header className="mb-8">
          <DashboardLogo />

          {/* 実データ / ダミーバッジ＋更新日時 */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {isReal ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-600 text-xs font-black">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  実データ
                </span>
                <span className="text-xs font-bold text-slate-400">
                  最終更新: {toJST(data.generatedAt)} JST
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-black">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  ダミーデータ（デザイン確認用）
                </span>
                <span className="text-xs font-bold text-slate-400">
                  最終更新: 2026-06-16 18:30（ダミー）
                </span>
              </>
            )}
          </div>
        </header>

        {/* ── KPI スタット行（2×2 → lgで4列） ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="KPI">
          {kpiData.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </section>

        {/* ── チャートグリッド（モバイル1列 / lg 2列） ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* (a) 単語別初回正答率 */}
          <Card
            title="単語別 初回正答率（難しい順）"
            subtitle="色: 赤<50%・黄50-70%・緑>70%"
          >
            <HorizontalBarChart items={wordAccuracy} />
          </Card>

          {/* (b) リテンション */}
          <Card
            title="継続率（リテンション）"
            subtitle="D1 / D3 / D7 / D14 / D30"
          >
            <RetentionChart items={retention} />
          </Card>

          {/* (c) 到達レベル分布 */}
          <Card
            title="到達レベル分布"
            subtitle="▼は前レベルからの残存率"
          >
            <LevelDistChart items={levelDist} />
          </Card>

          {/* (d) 日次 DAU + クイズ完了 */}
          <Card
            title="日次アクティブ＆クイズ完了"
            subtitle="直近14日間"
          >
            <DailyLineChart items={daily14} />
          </Card>

          {/* (e) ログイン方法の内訳（lgではフル幅） */}
          <Card
            title="ログイン方法の内訳"
            subtitle="全ユーザー比率"
            className="lg:col-span-2"
          >
            <DonutChart items={loginDist} />
          </Card>

        </section>

        {/* ── フッター ── */}
        <footer className="mt-10 text-center">
          {!isReal && (
            <p className="text-xs font-bold text-slate-400">
              ※ 表示はすべてダミーデータです。実データ連携は Supabase 設定後に自動で切り替わります。
            </p>
          )}
        </footer>

      </div>
    </div>
  );
}

// ─── KPI data ビルダー（実データ → KpiCard props 配列に変換） ──────────────────

function buildKpiData(kpi) {
  if (!kpi) return KPI_DATA;
  const fmt = (n) => typeof n === 'number' ? n.toLocaleString('ja-JP') : String(n ?? 0);
  return [
    {
      label: '累計ユーザー',
      value: fmt(kpi.totalUsers),
      unit: '人',
      delta: kpi.totalUsersDelta ?? null,
      up: kpi.totalUsersDelta > 0,
      icon: '👥',
    },
    {
      label: '今日のアクティブ',
      value: fmt(kpi.todayActive),
      unit: '人',
      delta: kpi.todayActiveDelta ?? null,
      up: kpi.todayActiveDelta > 0,
      icon: '⚡',
    },
    {
      label: 'クイズ完了数',
      value: fmt(kpi.totalQuizzes),
      unit: '回',
      delta: kpi.totalQuizzesDelta ?? null,
      up: kpi.totalQuizzesDelta > 0,
      icon: '🎯',
    },
    {
      label: '平均初回正答率',
      value: String(kpi.avgFirstTryPct ?? 0),
      unit: '%',
      delta: kpi.avgFirstTryPctDelta ?? null,
      up: kpi.avgFirstTryPctDelta > 0,
      icon: '🧠',
    },
  ];
}
