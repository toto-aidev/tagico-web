'use client';

// components/Extra.jsx — マイ単語帳（ブックマーク）と 統計タブ（tagico-studio/v2-extra.jsx の移植）

import React, { useState } from 'react';
import Icon from '@/components/Icon';
import { SummaryBody, BottomNav } from '@/components/Summary';
import { FeedbackLink } from '@/components/Survey';
import { LEVELS, getWord } from '@/lib/content';
import { SURVEY_URL } from '@/lib/store';

// ===== マイ単語帳：ブックマークした用法まとめを集めた自分専用の単語帳 =====
export function MyWordbookScreen({ appState, onToggleBookmark, onToggleSavedSense, onNavigate }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const ids = (appState.bookmarks || []).slice();
  const words = ids.map((id) => getWord(id)).filter(Boolean);
  const savedItems = (appState.savedSenses || []).map((k) => {
    const p = String(k).split(':'); const w = getWord(p[0]);
    if (!w) return null; const f = w.faces[Number(p[1])]; if (!f) return null;
    return { key: k, word: w, face: f, fi: Number(p[1]) };
  }).filter(Boolean);

  return (
    <div className="flex flex-col max-w-md lg:max-w-[980px] lg:shadow-[0_10px_60px_rgba(15,23,42,0.10)] w-full mx-auto bg-slate-50 min-h-screen relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-20%] w-96 h-96 bg-rose-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-4 px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-100 text-rose-500">
          <Icon name="bookmark" size={20} fill="currentColor" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">マイ単語帳</h1>
          <p className="text-xs font-bold text-slate-400">{words.length} 語 ・ 忘れがち {savedItems.length}</p>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-6 overflow-y-auto relative z-10 pb-28 lg:pb-10">
        {savedItems.length === 0 && words.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-center px-8">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-400 flex items-center justify-center mb-4">
              <Icon name="bookmark" size={28} />
            </div>
            <p className="font-black text-slate-600 mb-1">まだ何も保存されていません</p>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">クイズ後の「用法まとめ」内、各用法の <span className="inline-flex align-middle items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[0.6rem] font-bold"><Icon name="bookmark" size={9} fill="currentColor" />忘れがち</span> を押すと、ここに集まります。</p>
          </div>
        )}

        {savedItems.length > 0 && (
          <div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center"><Icon name="bookmark" size={11} fill="currentColor" /></span>
              忘れがちな用法（{savedItems.length}）
            </h2>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:content-start">
              {savedItems.map((it) => (
                <div key={it.key} className="rounded-3xl bg-white border-2 border-amber-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-800">{it.word.word}</span>
                        <span className="font-bold text-slate-700 text-sm">{it.face.name}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 mt-0.5">{it.face.meaning}</p>
                    </div>
                    <button onClick={() => onToggleSavedSense(it.word.id, it.fi)} className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-rose-500 flex items-center justify-center active:scale-90 transition-all shrink-0" title="外す">
                      <Icon name="x" size={14} strokeWidth={3} />
                    </button>
                  </div>
                  {it.face.type && <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[0.65rem] font-bold">{it.face.type}</span>}
                  {it.face.note && <p className="text-xs font-medium text-slate-400 mt-1.5">{it.face.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {words.length > 0 && (
          <div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center"><Icon name="bookmark" size={11} fill="currentColor" /></span>
              ブックマークした単語（{words.length}）
            </h2>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:content-start">
              {words.map((word) => {
          const isOpen = open.has(word.id);
          return (
            <div key={word.id} className="rounded-3xl overflow-hidden bg-white border-2 border-rose-100 shadow-sm">
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => toggle(word.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center shrink-0">
                    <Icon name="bookmark" size={18} fill="currentColor" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-slate-800">{word.word}</span>
                      <span className="text-[0.6rem] font-bold text-rose-400 bg-rose-50 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">{word.faces.length}用法</span>
                    </div>
                    <p className="text-xs font-medium text-slate-400 truncate">{word.coreImage.headline}</p>
                  </div>
                </button>
                <button onClick={() => onToggleBookmark(word.id)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:text-rose-500 flex items-center justify-center active:scale-90 transition-all" title="マイ単語帳から外す">
                  <Icon name="x" size={16} strokeWidth={3} />
                </button>
                <button onClick={() => toggle(word.id)} className={'w-8 h-8 rounded-full flex items-center justify-center ' + (isOpen ? 'bg-teal-400 text-white' : 'bg-slate-100 text-slate-400')}>
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} />
                </button>
              </div>
              {isOpen && (
                <div className="tg-fadeup px-4 pb-4 border-t border-slate-100 pt-4">
                  <SummaryBody word={word} />
                </div>
              )}
            </div>
          );
            })}
            </div>
          </div>
        )}
      </div>
      <BottomNav active="my" onNavigate={onNavigate} />
    </div>
  );
}

// ===== 統計：これまでの実績 =====
function StatChip({ value, label, sub, color }) {
  return (
    <div className="rounded-3xl p-4 bg-white border-2 border-slate-100 shadow-sm">
      <div className={'text-3xl font-black ' + (color || 'text-slate-800')}>{value}</div>
      <div className="text-xs font-bold text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-[0.65rem] font-medium text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function StatsScreen({ appState, onNavigate }) {
  const allIds = LEVELS.flatMap((l) => l.wordIds);
  const mastered = (appState.cleared || []).filter((id) => allIds.indexOf(id) >= 0).length;
  const totalWords = allIds.length;
  const hist = appState.history || {};
  const attempts = Object.keys(hist).reduce((s, k) => s + (hist[k].attempts || 0), 0);
  const trapAvoids = appState.trapAvoids || 0;
  const trapHits = appState.trapHits || 0;
  const trapTotal = trapAvoids + trapHits;
  const avoidRate = trapTotal > 0 ? Math.round((trapAvoids / trapTotal) * 100) : 0;
  const streak = appState.streakDays || 0;

  // 直近7日のアクティビティ
  const days = appState.days || {};
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    week.push({ key, count: days[key] || 0, label: '日月火水木金土'[d.getDay()], today: i === 0 });
  }
  const weekMax = Math.max(1, ...week.map((w) => w.count));

  // 実績バッジ
  const badges = [
    { id: 'first', icon: 'check-circle', label: '最初の一歩', desc: '1語クリア', color: 'teal', earned: mastered >= 1 },
    { id: 'five', icon: 'star', label: '5語マスター', desc: '5語クリア', color: 'amber', earned: mastered >= 5 },
    { id: 'all', icon: 'trophy', label: '全制覇', desc: '全単語クリア', color: 'rose', earned: totalWords > 0 && mastered >= totalWords },
    { id: 'streak', icon: 'flame', label: '7日連続', desc: '7日ストリーク', color: 'rose', earned: streak >= 7 },
    { id: 'trap', icon: 'sparkles', label: '罠回避マスター', desc: '罠回避10回', color: 'teal', earned: trapAvoids >= 10 },
    { id: 'book', icon: 'bookmark', label: 'コレクター', desc: 'マイ単語帳に保存', color: 'indigo', earned: (appState.bookmarks || []).length >= 1 },
  ];
  const COLOR = {
    teal: ['bg-teal-100', 'text-teal-500'], amber: ['bg-amber-100', 'text-amber-500'],
    rose: ['bg-rose-100', 'text-rose-500'], indigo: ['bg-indigo-100', 'text-indigo-500'],
  };

  return (
    <div className="flex flex-col max-w-md lg:max-w-[980px] lg:shadow-[0_10px_60px_rgba(15,23,42,0.10)] w-full mx-auto bg-slate-50 min-h-screen relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-teal-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-4 px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-100 text-teal-600">
          <Icon name="bar-chart" size={20} />
        </div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight">統計</h1>
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-5 overflow-y-auto relative z-10 pb-28 lg:pb-10">
        {/* 数値カード */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatChip value={mastered} label="マスター語数" sub={'全 ' + totalWords + ' 語中'} color="text-teal-500" />
          <StatChip value={streak} label="連続学習日数" sub="日" color="text-rose-500" />
          <StatChip value={attempts} label="挑戦回数" color="text-slate-800" />
          <StatChip value={avoidRate + '%'} label="罠 回避率" sub={trapAvoids + ' / ' + trapTotal + ' 回'} color="text-amber-500" />
        </div>

        {/* 週間アクティビティ */}
        <div className="rounded-3xl p-5 bg-white border-2 border-slate-100 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">この7日間</h2>
          <div className="flex items-end justify-between gap-2 h-28">
            {week.map((w) => (
              <div key={w.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  className={'w-full rounded-lg ' + (w.count > 0 ? (w.today ? 'bg-teal-400' : 'bg-teal-200') : 'bg-slate-100')}
                  style={{ height: Math.max(6, (w.count / weekMax) * 88) + 'px' }}
                  title={w.count + ' 語'}
                />
                <span className={'text-[0.65rem] font-bold ' + (w.today ? 'text-teal-500' : 'text-slate-400')}>{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* レベル別の進捗 */}
        <div className="rounded-3xl p-5 bg-white border-2 border-slate-100 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">レベル別の進捗</h2>
          <div className="flex flex-col gap-3.5">
            {LEVELS.map((l) => {
              const c = l.wordIds.filter((id) => (appState.cleared || []).indexOf(id) >= 0).length;
              const pct = Math.round((c / l.wordIds.length) * 100);
              return (
                <div key={l.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-slate-600">{l.name}</span>
                    <span className="text-xs font-bold text-slate-400">{c}/{l.wordIds.length}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-300" style={{ width: pct + '%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 実績バッジ */}
        <div className="rounded-3xl p-5 bg-white border-2 border-slate-100 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">実績</h2>
          <div className="grid grid-cols-3 gap-3">
            {badges.map((b) => {
              const col = COLOR[b.color];
              return (
                <div key={b.id} className={'flex flex-col items-center text-center p-3 rounded-2xl border-2 ' + (b.earned ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent opacity-50')}>
                  <div className={'w-12 h-12 rounded-2xl flex items-center justify-center mb-2 ' + (b.earned ? col[0] + ' ' + col[1] : 'bg-slate-200 text-slate-400')}>
                    <Icon name={b.icon} size={22} fill={b.earned && (b.icon === 'star' || b.icon === 'bookmark' || b.icon === 'sparkles') ? 'currentColor' : undefined} />
                  </div>
                  <span className="text-[0.7rem] font-black text-slate-700 leading-tight">{b.label}</span>
                  <span className="text-[0.6rem] font-medium text-slate-400 mt-0.5 leading-tight">{b.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 常設のフィードバック導線（統計ページ最下部・いつでも Tally アンケートを開ける） */}
        <div className="pt-2">
          <FeedbackLink url={SURVEY_URL} />
        </div>
      </div>
      <BottomNav active="stats" onNavigate={onNavigate} />
    </div>
  );
}
