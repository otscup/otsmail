#!/bin/bash
# 并行上传 dist/ 到 R2 mail-r2 的 web/ 前缀 (绕开坏的 Assets 绑定)
set -e
DIST="dist"
BKT="mail-r2"
PREFIX="web"
cd "$(dirname "$0")"

# 生成文件列表
find "$DIST" -type f > /tmp/r2_files.txt

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
    *.webmanifest) echo "application/manifest+json" ;;
    *) echo "application/octet-stream" ;;
  esac
}

export -f ct
upload_one() {
  local f="$1"
  local rel="${f#$DIST/}"
  local key="$PREFIX/$rel"
  local content_type
  content_type=$(ct "$f")
  npx wrangler r2 object put "$BKT/$key" --file "$f" --content-type "$content_type" >/dev/null 2>&1
}
export -f upload_one

echo "开始并行上传 $(wc -l < /tmp/r2_files.txt) 个文件..."
# 并行 6 个
cat /tmp/r2_files.txt | xargs -P 6 -I {} bash -c 'upload_one "$@"' _ {}
echo "上传完成 -> r2://$BKT/$PREFIX/"
