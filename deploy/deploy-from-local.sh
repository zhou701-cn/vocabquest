#!/usr/bin/env bash
# 本地构建 + 同步到 ECS + 重建容器（无域名 / 2核4G 方案）
#
# 前置：
#   1. 服务器上已完成 deploy-ip-access.md 的第 2-3 步（初始化 + Docker）
#   2. 服务器上 /home/deploy/vocabquest 已存在且配置好 .env.deploy
#   3. 本机可 SSH 免密登录
#
# 用法：./deploy/deploy-from-local.sh <服务器IP> [用户名，默认 deploy]
set -e

HOST=${1:?用法: $0 <服务器IP> [用户名]}
USER=${2:-deploy}
REMOTE_DIR=/home/deploy/vocabquest

cd "$(dirname "$0")/.."

echo "==> 0/4 检查远程环境"
ssh "$USER@$HOST" "mkdir -p $REMOTE_DIR"

if ssh "$USER@$HOST" "[ ! -f $REMOTE_DIR/.env.deploy ]"; then
  scp .env.deploy.example "$USER@$HOST:$REMOTE_DIR/.env.deploy"
  echo "⚠️  已用模板生成 .env.deploy（默认密码），请按下面步骤改成自己的密钥后 recreate"
fi

echo "==> 1/4 本地构建前端"
pnpm build:prod

echo "==> 2/4 同步 dist"
rsync -av --delete dist/ "$USER@$HOST:$REMOTE_DIR/dist/"

echo "==> 3/4 同步后端与部署配置"
rsync -av --exclude node_modules --exclude dist --exclude .env \
  server/ "$USER@$HOST:$REMOTE_DIR/server/"
rsync -av deploy/ "$USER@$HOST:$REMOTE_DIR/deploy/"
scp docker-compose.yml "$USER@$HOST:$REMOTE_DIR/"
scp .dockerignore Dockerfile "$USER@$HOST:$REMOTE_DIR/"

echo "==> 4/4 远程重建并启动"
ssh "$USER@$HOST" "cd $REMOTE_DIR && docker compose --env-file .env.deploy up -d --build"

echo "==> 完成，访问 http://$HOST"
echo
echo "提示："
echo "  · 若为首次部署且用了默认密码，请立刻修改密钥（DB_PASSWORD 必须在首次启动前定好，之后修改需删库重建）："
echo "      ssh $USER@$HOST"
echo "      cd $REMOTE_DIR && openssl rand -base64 24 && vim .env.deploy"
echo "      docker compose --env-file .env.deploy up -d --force-recreate"
echo "  · 若 80 端口访问不了（未备案被拦），把 docker-compose.yml 的 web 端口改成 '8080:80' 后重跑本脚本"
