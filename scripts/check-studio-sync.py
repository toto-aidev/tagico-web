#!/usr/bin/env python3
"""
check-studio-sync.py
Tagico Studio (Electron) の localStorage から最新の tagico-v2-content を抽出し、
tagico-web/data/content.json との差分を検出する。

読み取り専用設計 — leveldb ファイルを一切変更しない。

使い方:
    python3 scripts/check-studio-sync.py

終了コード:
    0 : 差分なし（デプロイ可）
    1 : 差分あり（差分一覧を表示してデプロイを中止）
    2 : Studio データが見つからない or 抽出失敗
"""
import json
import os
import re
import struct
import shutil
import sys
import tempfile

# ---- パス定義 ----------------------------------------------------------------
LEVELDB_DIR = os.path.expanduser(
    "~/Library/Application Support/tagico-studio/Local Storage/leveldb/"
)
LOG_FILE = os.path.join(LEVELDB_DIR, "000004.log")
CONTENT_JSON = os.path.join(
    os.path.dirname(__file__),
    "../data/content.json"
)

TARGET_KEY = b"tagico-v2-content"

# leveldb log の block/record 定数
BLOCK_SIZE = 32768
FULL, FIRST, MIDDLE, LAST = 1, 2, 3, 4


# ---- leveldb log パーサ -------------------------------------------------------

def parse_log(filepath: str) -> list[bytes]:
    """leveldb log ファイルからすべてのレコード payload を組み立てて返す。"""
    with open(filepath, "rb") as f:
        data = f.read()

    raw_records = []
    pos = 0
    while pos < len(data):
        block_offset = pos % BLOCK_SIZE
        if BLOCK_SIZE - block_offset < 7:
            pos += BLOCK_SIZE - block_offset
            continue
        if pos + 7 > len(data):
            break
        length = struct.unpack_from("<H", data, pos + 4)[0]
        rtype = data[pos + 6]
        if rtype not in (FULL, FIRST, MIDDLE, LAST):
            pos += 1
            continue
        payload = data[pos + 7 : pos + 7 + length]
        raw_records.append({"type": rtype, "payload": payload})
        pos += 7 + length

    assembled = []
    current = None
    for r in raw_records:
        if r["type"] == FULL:
            assembled.append(r["payload"])
        elif r["type"] == FIRST:
            current = bytearray(r["payload"])
        elif r["type"] == MIDDLE and current is not None:
            current.extend(r["payload"])
        elif r["type"] == LAST and current is not None:
            current.extend(r["payload"])
            assembled.append(bytes(current))
            current = None

    return assembled


def read_varint(data: bytes, pos: int) -> tuple[int, int]:
    result, shift = 0, 0
    while pos < len(data):
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        if not (byte & 0x80):
            break
        shift += 7
    return result, pos


def extract_tagico_content(records: list[bytes]) -> dict | None:
    """
    組み立て済みレコード群から tagico-v2-content の最新値を抽出して返す。
    複数回出現する場合は最後（最新）のものを採用。
    """
    result = None
    for payload in records:
        kp = payload.find(TARGET_KEY)
        if kp == -1:
            continue
        after = payload[kp + len(TARGET_KEY) :]
        vlen, vstart = read_varint(after, 0)
        vbytes = after[vstart : vstart + vlen]
        # Chromium localStorage: 先頭 1 バイトは version (0x00)
        if vbytes and vbytes[0] == 0x00:
            vbytes = vbytes[1:]

        try:
            text = vbytes.decode("utf-16-le", errors="replace")
            # 制御文字除去（改行・タブは保持）
            text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
            start = text.find("{")
            if start < 0:
                continue
            depth, end = 0, -1
            for ci, ch in enumerate(text[start:], start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = ci + 1
                        break
            if end > 0:
                obj = json.loads(text[start:end])
                result = obj  # 後から出てくるものほど新しい
        except Exception:
            continue
    return result


# ---- 差分チェック -------------------------------------------------------------

# テスト用に一時的に入力された値と判断するキーワード
TEST_VALUE_PATTERNS = [re.compile(r"ZZTEST", re.IGNORECASE)]


def is_test_value(value) -> bool:
    if isinstance(value, str):
        return any(p.search(value) for p in TEST_VALUE_PATTERNS)
    return False


def word_diff(studio_word: dict, current_word: dict) -> list[dict]:
    """2つの語オブジェクトのフィールド差分を返す。テスト値は無視。"""
    diffs = []
    all_fields = set(list(studio_word.keys()) + list(current_word.keys()))
    for field in sorted(all_fields):
        sv = studio_word.get(field)
        cv = current_word.get(field)
        # Studio 版がテスト入力ならスキップ
        if is_test_value(sv):
            continue
        # Studio 側にしか存在しないフィールドは現行にないので追加の可能性
        if sv != cv:
            diffs.append({"field": field, "studio": sv, "current": cv})
    return diffs


# ---- メイン ------------------------------------------------------------------

def main() -> int:
    # 1. leveldb ファイルの存在確認
    if not os.path.isfile(LOG_FILE):
        print(f"[ERROR] Studio の leveldb が見つかりません: {LOG_FILE}")
        print("  Tagico Studio を一度起動して終了してから再実行してください。")
        return 2

    # 2. /tmp に安全コピー（読み取り専用保証）
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_log = os.path.join(tmpdir, "000004.log")
        shutil.copy2(LOG_FILE, tmp_log)

        # 3. leveldb から Studio の最新コンテンツを抽出
        try:
            records = parse_log(tmp_log)
        except Exception as e:
            print(f"[ERROR] leveldb log のパース失敗: {e}")
            return 2

        studio_content = extract_tagico_content(records)

    if not studio_content:
        print("[WARN] tagico-v2-content が leveldb に見つかりませんでした。")
        print("  Tagico Studio で一度コンテンツを保存してから再実行してください。")
        return 2

    # 4. 現行 content.json を読み込む
    content_json_path = os.path.normpath(CONTENT_JSON)
    if not os.path.isfile(content_json_path):
        print(f"[ERROR] content.json が見つかりません: {content_json_path}")
        return 2

    with open(content_json_path, encoding="utf-8") as f:
        current_content = json.load(f)

    studio_words = {w["id"]: w for w in studio_content.get("words", [])}
    current_words = {w["id"]: w for w in current_content.get("words", [])}

    studio_ids = set(studio_words.keys())
    current_ids = set(current_words.keys())
    shared_ids = studio_ids & current_ids
    only_studio = studio_ids - current_ids
    only_current = current_ids - studio_ids

    print(f"Studio版: {len(studio_words)} 語")
    print(f"現行 content.json: {len(current_words)} 語")
    print(f"共通語: {len(shared_ids)} 語 / Studio のみ: {len(only_studio)} 語 / 現行のみ: {len(only_current)} 語")

    # 5. 差分チェック
    found_diffs = False

    # 共通語のフィールド差分
    field_diffs: dict[str, list[dict]] = {}
    for wid in sorted(shared_ids):
        diffs = word_diff(studio_words[wid], current_words[wid])
        if diffs:
            field_diffs[wid] = diffs

    # Studio にしかない語（新規追加候補）
    if only_studio:
        found_diffs = True
        print(f"\n[DIFF] Studio 版にのみ存在する語（content.json に未追加）:")
        for wid in sorted(only_studio):
            print(f"  + {wid}")

    # フィールド差分
    if field_diffs:
        found_diffs = True
        print(f"\n[DIFF] フィールド差分のある語 ({len(field_diffs)} 語):")
        for wid, diffs in field_diffs.items():
            print(f"\n  語: {wid}")
            for d in diffs:
                sv_str = json.dumps(d["studio"], ensure_ascii=False)
                cv_str = json.dumps(d["current"], ensure_ascii=False)
                # 長い値は省略
                if len(sv_str) > 120:
                    sv_str = sv_str[:120] + "..."
                if len(cv_str) > 120:
                    cv_str = cv_str[:120] + "..."
                print(f"    [{d['field']}]")
                print(f"      Studio : {sv_str}")
                print(f"      現行   : {cv_str}")

    if not found_diffs:
        print("\n[OK] 差分なし — Studio 版と content.json は同期されています。デプロイ可。")
        return 0
    else:
        print(
            "\n[STOP] 差分があります。上記を確認し、必要なら Studio 版の変更を"
            " content.json にマージしてからデプロイしてください。"
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
