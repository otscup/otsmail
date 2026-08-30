#!/bin/bash
# 前台串行上传 mail-vue/dist -> R2 mail-r2/web/ (--remote 真实R2)
# 函数内联同作用域, 不走 xargs/bash -c (避开 MSYS export -f 失效)
# wrangler 输出丢/dev/null, 仅记纯文本 OK/FAIL
DIST="E:/otsmail/mail-worker/dist"
BKT="mail-r2"
PREFIX="web"
LOG="E:/otsmail/mail-worker/_upload_web.log"
: > "$LOG"

ct() {
  case "$1" in
    *.html) echo "text/html; charset=utf-8" ;;
    *.js)   echo "application/javascript; charset=utf-8" ;;
    *.css)  echo "text/css; charset=utf-8" ;;
    *.json) echo "application/json; charset=utf-8" ;;
    *.svg)  echo "image/svg+xml" ;;
    *.png)  echo "image/png" ;;
    *.jpg|*.jpeg) echo "image/jpeg" ;;
    *.ico)  echo "image/x-icon" ;;
    *.woff2) echo "font/woff2" ;;
    *.woff) echo "font/woff" ;;
    *.webmanifest) echo "application/manifest+json" ;;
    *) echo "application/octet-stream" ;;
  esac
}

OK=0; FAIL=0
while IFS= read -r f; do
  rel="${f#$DIST/}"
  key="$PREFIX/$rel"
  ct_str=$(ct "$f")
  if npx wrangler r2 object put "$BKT/$key" --file "$f" --content-type "$ct_str" --remote >/dev/null 2>&1; then
    OK=$((OK+1)); echo "OK $key" >> "$LOG"
  else
    FAIL=$((FAIL+1)); echo "FAIL $key" >> "$LOG"
  fi
done < <(find "$DIST" -type f)
echo "上传结束: OK=$OK FAIL=$FAIL" >> "$LOG"
