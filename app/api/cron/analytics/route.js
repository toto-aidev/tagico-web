// app/api/cron/analytics/route.js — 毎朝 Cron でスナップショットを生成して Supabase に保存
//
// Vercel Cron: vercel.json で毎日 UTC 09:30（JST 18:30）に呼び出す。
// 手動確認: curl -H "Authorization: Bearer <CRON_SECRET>" <URL>/api/cron/analytics
//
// ★ 鍵未設定の dev 環境でも壊れない設計:
//   - POSTHOG_PERSONAL_API_KEY 未設定 → { skipped: true } を 200 で返す
//   - getServiceClient() が null     → { skipped: true } を 200 で返す
//   - 各 HogQL クエリが失敗           → 個別に try/catch して 0/空配列にフォールバック
//   - throw は絶対にしない

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getServiceClient } from '@/lib/supabase-server';

/** PostHog HogQL Query API を叩く共通ヘルパー */
async function hogql(apiKey, host, projectId, query) {
  const url = `${host}/api/projects/${projectId}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`HogQL ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.results ?? []; // results は行配列（各行は列順の配列）
}

/** ゼロ安全な数値変換 */
function toNum(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/** MM/DD 形式 */
function toMMDD(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

export async function GET(request) {
  // ① CRON_SECRET が設定されていれば Authorization を検証する
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // ② PostHog の鍵が未設定なら skip（ビルド・dev を壊さない）
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) {
    return Response.json({ skipped: true, reason: 'POSTHOG_PERSONAL_API_KEY not set' });
  }

  const host = process.env.POSTHOG_HOST || 'https://us.posthog.com';
  const projectId = process.env.POSTHOG_PROJECT_ID || '472810';

  // ③ 各 HogQL クエリを try/catch で囲んでフォールバック付きで実行
  // ─── KPI ───────────────────────────────────────────────────────────
  let totalUsers = 0;
  try {
    const rows = await hogql(apiKey, host, projectId,
      `SELECT count(DISTINCT distinct_id) FROM events`
    );
    totalUsers = toNum(rows[0]?.[0]);
  } catch (_) {}

  let todayActive = 0;
  try {
    const rows = await hogql(apiKey, host, projectId,
      `SELECT count(DISTINCT distinct_id) FROM events WHERE event='$pageview' AND toDate(timestamp)=today()`
    );
    todayActive = toNum(rows[0]?.[0]);
  } catch (_) {}

  let totalQuizzes = 0;
  try {
    const rows = await hogql(apiKey, host, projectId,
      `SELECT count() FROM events WHERE event='quiz_completed'`
    );
    totalQuizzes = toNum(rows[0]?.[0]);
  } catch (_) {}

  let avgFirstTryPct = 0;
  try {
    const rows = await hogql(apiKey, host, projectId,
      `SELECT round(100.0*countIf(properties.is_correct=true)/count(),1) FROM events WHERE event='answer_result' AND properties.is_replay=false AND properties.is_retry=false`
    );
    avgFirstTryPct = toNum(rows[0]?.[0]);
  } catch (_) {}

  // ─── wordAccuracy ──────────────────────────────────────────────────
  let wordAccuracy = [];
  try {
    const rows = await hogql(apiKey, host, projectId,
      `SELECT properties.word, round(100.0*countIf(properties.is_correct=true)/count(),1), count() ` +
      `FROM events WHERE event='answer_result' AND properties.is_replay=false AND properties.is_retry=false ` +
      `GROUP BY properties.word HAVING count()>0 ORDER BY 2 ASC LIMIT 12`
    );
    wordAccuracy = rows.map(([word, pct, n]) => ({ word: String(word ?? ''), pct: toNum(pct), n: toNum(n) }));
  } catch (_) {}

  // ─── levelDist ─────────────────────────────────────────────────────
  // properties.level は quiz_completed イベントの levelId（例: "lv1"）
  // 表示用に "Lv 1" 形式に整形（数値・文字列どちらでも対応）
  let levelDist = [];
  try {
    const rows = await hogql(apiKey, host, projectId,
      `SELECT properties.level, count(DISTINCT distinct_id) FROM events WHERE event='level_cleared' GROUP BY properties.level ORDER BY properties.level`
    );
    levelDist = rows.map(([lv, count]) => {
      // "lv1" → "Lv 1", "1" → "Lv 1", 1 → "Lv 1" に整形
      const raw = String(lv ?? '');
      const num = raw.replace(/^[Ll][Vv]\s*/i, '');
      const label = num ? `Lv ${num}` : raw;
      return { lv: label, count: toNum(count) };
    });
  } catch (_) {}

  // ─── daily14 ───────────────────────────────────────────────────────
  // DAU と quiz_completed を別クエリで取得し、日付をキーにしてマージする
  let daily14 = [];
  try {
    const dauRows = await hogql(apiKey, host, projectId,
      `SELECT toDate(timestamp), count(DISTINCT distinct_id) FROM events ` +
      `WHERE event='$pageview' AND timestamp > now() - INTERVAL 14 DAY GROUP BY 1 ORDER BY 1`
    );
    const quizRows = await hogql(apiKey, host, projectId,
      `SELECT toDate(timestamp), count() FROM events ` +
      `WHERE event='quiz_completed' AND timestamp > now() - INTERVAL 14 DAY GROUP BY 1 ORDER BY 1`
    );

    // dayMap: "YYYY-MM-DD" → { dau, quiz }
    const dayMap = {};
    dauRows.forEach(([day, dau]) => {
      const k = String(day);
      dayMap[k] = { ...dayMap[k], dau: toNum(dau) };
    });
    quizRows.forEach(([day, quiz]) => {
      const k = String(day);
      dayMap[k] = { ...dayMap[k], quiz: toNum(quiz) };
    });

    // 直近14日を昇順で 0 埋めして生成
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const k = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
      daily14.push({
        day: toMMDD(k),
        dau: dayMap[k]?.dau ?? 0,
        quiz: dayMap[k]?.quiz ?? 0,
      });
    }
  } catch (_) {}

  // ─── loginDist ─────────────────────────────────────────────────────
  // method: "google" | "email"。匿名 = 全ユーザー − ログインユーザーの sum
  let loginDist = [];
  try {
    const loginRows = await hogql(apiKey, host, projectId,
      `SELECT properties.method, count(DISTINCT distinct_id) FROM events WHERE event='login' GROUP BY properties.method`
    );
    const methodMap = {};
    let loggedInTotal = 0;
    loginRows.forEach(([method, cnt]) => {
      const c = toNum(cnt);
      methodMap[String(method ?? '')] = c;
      loggedInTotal += c;
    });

    const anonymous = Math.max(0, totalUsers - loggedInTotal);
    const google = methodMap['google'] ?? 0;
    const email = methodMap['email'] ?? 0;
    const total = anonymous + google + email;

    if (total > 0) {
      loginDist = [
        { label: '匿名',   pct: Math.round((anonymous / total) * 100) },
        { label: 'メール', pct: Math.round((email     / total) * 100) },
        { label: 'Google', pct: Math.round((google    / total) * 100) },
      ];
      // 合計が 100 になるよう最大セグメントで端数調整
      const sum = loginDist.reduce((s, d) => s + d.pct, 0);
      if (sum !== 100) {
        const maxIdx = loginDist.reduce((mi, d, i) => d.pct > loginDist[mi].pct ? i : mi, 0);
        loginDist[maxIdx].pct += (100 - sum);
      }
    }
  } catch (_) {}

  // ─── retention（best-effort 近似） ─────────────────────────────────
  // 算出ロジック: 「各 distinct_id の初回 $pageview 日付」を first_seen とし、
  // first_seen の N 日後（±1日のウィンドウ）にも $pageview を記録しているユーザーの割合。
  // HogQL でサブクエリのネストが深いため、ここでは簡易 2 クエリ方式を採用:
  //   Q1: 直近 60 日で初回観測されたユーザーの distinct_id と first_seen を取得（最大 10000 行）
  //   Q2: distinct_id + toDate(timestamp) の出現日を取得（最大 50000 行）
  //   JS 側で N 日後に再訪しているか判定して率を算出。
  // データが少ない場合（< 10 ユーザー）は空配列を返す。
  // TODO: データが多くなったら PostHog RetentionQuery（kind:"RetentionQuery"）に置換すること。
  let retention = [];
  try {
    const firstSeenRows = await hogql(apiKey, host, projectId,
      `SELECT distinct_id, min(toDate(timestamp)) as first_seen ` +
      `FROM events WHERE event='$pageview' AND timestamp > now() - INTERVAL 60 DAY ` +
      `GROUP BY distinct_id LIMIT 10000`
    );

    if (firstSeenRows.length >= 10) {
      const visitRows = await hogql(apiKey, host, projectId,
        `SELECT distinct_id, toDate(timestamp) FROM events WHERE event='$pageview' ` +
        `AND timestamp > now() - INTERVAL 60 DAY GROUP BY distinct_id, toDate(timestamp) LIMIT 50000`
      );

      // visitSet: Map<distinct_id, Set<"YYYY-MM-DD">>
      const visitSet = new Map();
      visitRows.forEach(([id, day]) => {
        const k = String(id);
        if (!visitSet.has(k)) visitSet.set(k, new Set());
        visitSet.get(k).add(String(day));
      });

      // D1/D3/D7/D14/D30 の達成率を算出
      const DAYS = [1, 3, 7, 14, 30];
      const labels = ['D1', 'D3', 'D7', 'D14', 'D30'];

      retention = DAYS.map((n, idx) => {
        const eligible = firstSeenRows.filter(([, first]) => {
          // first_seen から n+1 日以上経過したユーザーのみカウント対象
          const firstDate = new Date(String(first));
          const diffDays = (Date.now() - firstDate.getTime()) / 86400000;
          return diffDays >= n + 1;
        });
        if (eligible.length === 0) return { label: labels[idx], pct: 0 };
        const returned = eligible.filter(([id, first]) => {
          const firstDate = new Date(String(first));
          // ±1 日ウィンドウで確認（当日 / 翌日 / 翌々日）
          for (let w = 0; w <= 1; w++) {
            const target = new Date(firstDate);
            target.setUTCDate(target.getUTCDate() + n + w);
            const key = target.toISOString().slice(0, 10);
            if (visitSet.get(String(id))?.has(key)) return true;
          }
          return false;
        });
        const pct = Math.round((returned.length / eligible.length) * 100);
        return { label: labels[idx], pct };
      });
    }
  } catch (_) {}

  // ─── payload 組み立て ──────────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    kpi: {
      totalUsers,
      todayActive,
      totalQuizzes,
      avgFirstTryPct,
    },
    wordAccuracy,
    retention,
    levelDist,
    daily14,
    loginDist,
  };

  // ④ Supabase analytics_snapshots に upsert
  const supabase = getServiceClient();
  if (!supabase) {
    return Response.json({ skipped: true, reason: 'SUPABASE_SERVICE_ROLE_KEY not set', generatedAt });
  }

  const { error } = await supabase
    .from('analytics_snapshots')
    .upsert({ id: 'latest', payload, updated_at: generatedAt }, { onConflict: 'id' });

  if (error) {
    // テーブル未作成等の場合でもクラッシュさせない。500 ではなく 200 + errorInfo で返す。
    return Response.json({ ok: false, reason: error.message, generatedAt });
  }

  return Response.json({
    ok: true,
    generatedAt,
    counts: {
      wordAccuracy: wordAccuracy.length,
      levelDist: levelDist.length,
      daily14: daily14.length,
      loginDist: loginDist.length,
      retentionPoints: retention.length,
    },
  });
}
