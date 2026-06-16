// lib/supabase.js — Supabase クライアントのシングルトン
//
// 環境変数（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）が
// 未設定の場合（鍵投入前・ローカル開発など）は null を返し、他の機能を一切壊さない。
// 各呼び出し元は `if (!supabase) return;` でガードする設計（lib/auth.js / lib/sync.js 参照）。

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 鍵未設定なら null（未投入環境でも動作継続）
export const supabase = url && key ? createClient(url, key) : null;
