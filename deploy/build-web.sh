#!/usr/bin/env bash
# 本地构建前端静态产物（dist）
#
# 用于「服务器不编译前端」的省内存方案：开发机构建 → 只上传 dist。
# 用法：./deploy/build-web.sh
set -e

cd "$(dirname "$0")/.."

echo "==> 构建前端（BUILD_MODE=prod）"
pnpm build:prod

echo "==> 构建完成"
du -sh dist
ls dist | head
