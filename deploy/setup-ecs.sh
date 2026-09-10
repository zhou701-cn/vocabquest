#!/usr/bin/env bash
#
# ECS 服务器端一键初始化（Ubuntu 22.04 / Debian）
#
# 自动完成：系统更新 → 创建部署用户 → swap → 防火墙 → 安装 Docker + Compose
#           → 配置镜像加速器 → 创建应用目录
#
# 用法（在服务器上以 root 执行）：
#   sudo bash setup-ecs.sh                          # 默认用户 deploy，腾讯云公共镜像加速
#   sudo bash setup-ecs.sh --user myuser            # 自定义部署用户
#   sudo bash setup-ecs.sh --mirror https://xxx.mirror.aliyuncs.com   # 自定义加速器
#   sudo bash setup-ecs.sh --https                  # 同时放行 443（准备上域名时）
#
# 对应文档：deploy-ip-access.md 第 2、3 节

set -e

DEPLOY_USER=deploy
MIRROR="https://mirror.ccs.tencentyun.com"
ENABLE_443=0
SWAP_SIZE=2G

while [ $# -gt 0 ]; do
  case "$1" in
    --https)  ENABLE_443=1; shift ;;
    --mirror) MIRROR="$2"; shift 2 ;;
    --user)   DEPLOY_USER="$2"; shift 2 ;;
    -*)       echo "未知参数: $1" >&2; exit 1 ;;
    *)        DEPLOY_USER="$1"; shift ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "请以 root 执行：sudo bash $0" >&2
  exit 1
fi

if ! command -v apt >/dev/null 2>&1; then
  echo "本脚本仅支持 Ubuntu / Debian（apt）" >&2
  exit 1
fi

step() { echo; echo "=====> $1"; }

# ---------------- 1. 系统更新与基础工具 ----------------
step "1/6 更新系统并安装基础工具"
export DEBIAN_FRONTEND=noninteractive
apt update -y
apt upgrade -y
apt install -y git curl unzip htop rsync ca-certificates

# ---------------- 2. 创建部署用户 ----------------
step "2/6 创建部署用户：$DEPLOY_USER"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "用户 $DEPLOY_USER 已存在，跳过"
else
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  echo "提示：如需密码登录，请执行 passwd $DEPLOY_USER（推荐改用 SSH 密钥）"
fi
usermod -aG sudo "$DEPLOY_USER"

# 把当前登录用户（腾讯云 Ubuntu 镜像默认是 ubuntu）的 SSH 公钥复制给部署用户，
# 否则 deploy 用户无密码也无密钥，将无法 SSH 登录。
SUDO_NAME="${SUDO_USER:-root}"
SUDO_HOME=$(getent passwd "$SUDO_NAME" | cut -d: -f6)
mkdir -p "/home/$DEPLOY_USER/.ssh"
if [ -f "$SUDO_HOME/.ssh/authorized_keys" ]; then
  cp "$SUDO_HOME/.ssh/authorized_keys" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  echo "已复用 $SUDO_NAME 的 SSH 公钥"
else
  echo "⚠️  未找到 $SUDO_NAME 的 authorized_keys，请手动为 $DEPLOY_USER 配置密钥或执行 passwd $DEPLOY_USER"
fi
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
[ -f "/home/$DEPLOY_USER/.ssh/authorized_keys" ] && chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

# ---------------- 3. Swap（小内存机器防 OOM） ----------------
step "3/6 配置 swap（$SWAP_SIZE）"
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -ge 6144 ]; then
  echo "内存 ${TOTAL_MEM}MB 充足，跳过 swap"
elif swapon --show | grep -q '/swapfile'; then
  echo "swap 已存在，跳过"
else
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "swap 已启用"
fi

# ---------------- 4. 防火墙 ----------------
step "4/6 配置防火墙"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22   comment 'SSH'
  ufw allow 80   comment 'HTTP'
  ufw allow 8080 comment 'HTTP备用'
  if [ "$ENABLE_443" -eq 1 ]; then
    ufw allow 443 comment 'HTTPS'
  fi
  # 先放行 22 再启用，避免把自己关在外面
  echo "y" | ufw enable || true
  ufw status
else
  echo "未安装 ufw，跳过（请确认云厂商安全组已放行 22/80/8080）"
fi

# ---------------- 5. 安装 Docker ----------------
step "5/6 安装 Docker 与 Compose 插件"
if command -v docker >/dev/null 2>&1; then
  echo "Docker 已安装：$(docker --version)"
else
  # 优先走阿里云镜像，失败则回退官方脚本
  curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun \
    || curl -fsSL https://get.docker.com | sh
fi
apt install -y docker-compose-plugin || true
systemctl enable --now docker

# 配置镜像加速器 + 日志轮转（避免日志撑爆磁盘）
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": ["$MIRROR"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl daemon-reload
systemctl restart docker

# 允许部署用户免 sudo 使用 docker
usermod -aG docker "$DEPLOY_USER" || true

docker --version
docker compose version

# ---------------- 6. 创建应用目录 ----------------
step "6/6 创建应用目录"
APP_DIR=/home/$DEPLOY_USER/vocabquest
mkdir -p "$APP_DIR" "/home/$DEPLOY_USER/backups"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR" "/home/$DEPLOY_USER/backups"

# ---------------- 完成 ----------------
echo
echo "=============================================="
echo " 服务器初始化完成"
echo "=============================================="
echo " 部署用户 : $DEPLOY_USER"
echo " 应用目录 : $APP_DIR"
echo " 备份目录 : /home/$DEPLOY_USER/backups"
echo " 镜像加速 : $MIRROR"
echo
echo " 接下来的两步（在开发机执行）："
echo "   1. 上传并初始化："
echo "      ./deploy/deploy-from-local.sh <公网IP> $DEPLOY_USER"
echo "   2. 首次上传后到服务器配置密钥："
echo "      ssh $DEPLOY_USER@<公网IP>"
echo "      cd $APP_DIR && cp .env.deploy.example .env.deploy && vim .env.deploy"
echo
echo " 注意：还需在云厂商控制台的安全组中放行 22 / 80 / 8080 端口"
echo "=============================================="
