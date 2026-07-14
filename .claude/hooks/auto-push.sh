#!/usr/bin/env bash
# Claude Code の Stop フックから呼ばれ、作業内容を専用ブランチへ自動 commit / push する。
# 設計方針:
#  - 作業ツリー・ステージング(index)・現在のブランチ(main 等)を一切変更しない。
#    一時 index を使ってツリーを作り、commit-tree で専用ブランチにだけコミットを積む。
#  - .gitignore で .env / .env.* は除外済みのため秘密情報は含まれない。
#  - 非対話（認証プロンプトが出たら失敗させる）。資格情報は Git Credential Manager に保存済み前提。
set -euo pipefail

REPO="/c/temp/GeidaiAtelier/my-app"
BRANCH="claude/auto-updates"
export GIT_TERMINAL_PROMPT=0

cd "$REPO"

# 変更が無ければ何もしない
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

# 現在の作業ツリーから、実 index を汚さずにツリーオブジェクトを作る
TMP_INDEX="$REPO/.git/auto-push-index.$$"
export GIT_INDEX_FILE="$TMP_INDEX"
git read-tree HEAD
git add -A
TREE="$(git write-tree)"
unset GIT_INDEX_FILE
rm -f "$TMP_INDEX"

# 親コミット: 専用ブランチが既にあればその先端、無ければ現在の HEAD
if git rev-parse --verify -q "refs/heads/$BRANCH" >/dev/null; then
  PARENT="$(git rev-parse "refs/heads/$BRANCH")"
  # 前回の自動コミットから中身が変わっていなければスキップ
  if [ "$TREE" = "$(git rev-parse "$PARENT^{tree}")" ]; then
    exit 0
  fi
else
  PARENT="$(git rev-parse HEAD)"
fi

MSG="auto: Claude Code 自動更新 $(date '+%Y-%m-%d %H:%M:%S')"
COMMIT="$(git commit-tree "$TREE" -p "$PARENT" -m "$MSG")"
git update-ref "refs/heads/$BRANCH" "$COMMIT"
git push -q origin "$BRANCH"
