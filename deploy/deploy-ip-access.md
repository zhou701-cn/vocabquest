# 部署方案 A：无域名，公网 IP 直接访问（HTTP）

> 适用：先用 IP 验证线上环境、备案尚未完成、内部演示。
> 后续要上域名时，按 `deploy-domain-https.md` 操作即可，代码和镜像无需改动。

## 快速开始（两条命令）

```bash
# ① 服务器端：初始化（root 执行，装 Docker/用户/防火墙/目录）
sudo bash setup-ecs.sh

# ② 开发机：构建前端 + 上传 + 启动（服务器需先配好 .env.deploy）
./deploy/deploy-from-local.sh <公网IP> deploy
```

> 首次执行 ② 前，需先在服务器 `/home/deploy/vocabquest` 下
> `cp .env.deploy.example .env.deploy` 并填写 `DB_PASSWORD` 与 `JWT_SECRET`。
> 详细步骤见下方第 1-8 节。

---

## 0. 架构与端口

```
浏览器 → http://<公网IP>  →  ECS:80 (nginx 容器)
                              ├─ /        → 前端静态资源（含 /audio/*.mp3）
                              └─ /api/*   → 反代到 api:3001 (NestJS)
                                              └─ postgres:5432 (仅内网，不对外)
```

| 服务 | 容器内端口 | 对外暴露 |
|---|---|---|
| web (nginx) | 80 | 80（宿主机） |
| api (NestJS) | 3001 | 不直接暴露 |
| postgres | 5432 | **绝不对外暴露** |

---

## 1. ECS 选购与网络配置

| 项目 | 建议值 | 说明 |
|---|---|---|
| 地域 | 离用户最近（如华东 1 杭州） | 大陆节点延迟最低 |
| 规格 | **2 核 4G**（推荐） | 运行期仅占约 1.2G；前端在本地构建，服务器不跑 `vite build`，4G 绰绰有余 |
| 备选 | 2 核 8G | 想在服务器上直接构建前端时才需要（多花约 200-400 元/年） |
| 镜像 | Ubuntu 22.04 LTS | 本文命令基于 apt |
| 系统盘 | 40G+ | 建议另挂 100G 数据盘给 `/var/lib/docker` |
| 带宽 | 3-5 Mbps 或按量 | — |

**安全组入方向放行**：

| 端口 | 用途 | 建议 |
|---|---|---|
| 22 | SSH | 源 IP 限制为自己的出口 IP |
| 80 | HTTP | 全放行 |
| 8080 | 备用 HTTP | 全放行（80 被拦时切换） |
| 5432 | Postgres | **不要放行** |

---

## 2. 服务器初始化

> **一键版**：把 `deploy/setup-ecs.sh` 上传到服务器后执行 `sudo bash setup-ecs.sh`，
> 即可自动完成本节与第 3 节（系统更新、建用户、swap、防火墙、Docker + 镜像加速、应用目录）。
> 下面是手动步骤，供需要精细控制时参考。

```bash
ssh root@<公网IP>

apt update && apt upgrade -y
apt install -y git curl unzip htop

# 创建部署用户，避免用 root 跑应用
adduser deploy
usermod -aG sudo deploy

# 小内存机器加 2G swap
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 防火墙（务必先 allow 22 再 enable，否则会把自己关在外面）
ufw allow 22 && ufw allow 80 && ufw allow 8080
ufw enable
ufw status
```

---

## 3. 安装 Docker（阿里云源 + 镜像加速）

```bash
# 使用阿里云镜像安装 Docker 与 Compose 插件
curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun
systemctl enable --now docker

# 镜像加速器地址获取：
#   阿里云控制台 → 容器镜像服务 → 镜像工具 → 镜像加速器（每人专属）
mkdir -p /etc/docker
tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://<你的ID>.mirror.aliyuncs.com"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl daemon-reload && systemctl restart docker

docker --version
docker compose version      # 需为 v2 插件
```

---

## 4. 本地构建前端 + 上传代码

> **2 核 4G 机型必读**：服务器镜像不再执行 `vite build`（内存峰值 2-3G 会 OOM），
> 必须先在**开发机**构建出 `dist/`，再上传。

### 4.1 本地构建

```bash
cd "/Volumes/Macintosh HD/Users/work/poem/vocabquest"
./deploy/build-web.sh          # 等价于 pnpm build:prod，产出 dist/
```

若提示权限不足，改用 `bash ./deploy/build-web.sh`（或先 `chmod +x deploy/*.sh`）。

### 4.2 上传到服务器

**方式 A：一键脚本（构建 + 上传 + 远程重建，推荐）**

```bash
./deploy/deploy-from-local.sh <公网IP> deploy
```

**方式 B：Git（便于版本管理）**

```bash
su - deploy
git clone <你的仓库地址> /home/deploy/vocabquest
cd /home/deploy/vocabquest/vocabquest   # 进入含 docker-compose.yml 的目录
```

**方式 C：手动 rsync（需要精细控制时用）**

在开发机执行（`dist` 必须上传，不能排除）：

```bash
rsync -av \
  --exclude node_modules \
  --exclude .env.local --exclude server/node_modules --exclude server/dist \
  "/Volumes/Macintosh HD/Users/work/poem/vocabquest/" \
  deploy@<公网IP>:/home/deploy/vocabquest/
```

---

## 5. 配置环境变量

```bash
cd /home/deploy/vocabquest
cp .env.deploy.example .env.deploy

# 生成两个随机串，分别作为 DB_PASSWORD 和 JWT_SECRET
openssl rand -base64 24
openssl rand -base64 32

vim .env.deploy
```

`.env.deploy` 最终形如：

```ini
DB_PASSWORD=<随机串1>
JWT_SECRET=<随机串2>
GEMINI_API_KEY=          # ECS 上连不通 Gemini，留空即可
```

> 前端 `VITE_API_BASE_URL` 保持留空：默认 `/api`，与页面同域，由 nginx 反代，无需配置。

---

## 6. 构建并启动

```bash
docker compose --env-file .env.deploy up -d --build

docker compose ps          # web / api / postgres 均应 Up
docker compose logs -f api # 确认出现 "Nest application successfully started"
```

首次启动时 Postgres 会自动执行 `server/db/schema.sql`（官方镜像 `docker-entrypoint-initdb.d` 机制，**仅在数据卷为空时执行**），创建 18 张表、2 个 SQL 函数并写入默认词库。

> `web` 服务此时只是把本地的 `dist/` 拷进 nginx 镜像，**不会**编译前端，几秒即可完成。
> 若报错 `COPY dist: no such file or directory`，说明漏了第 4.1 步。

---

## 7. 初始化管理员账号

1. 浏览器访问 `http://<公网IP>`
2. 点击注册，填入邮箱和密码
3. **第一个注册的用户自动成为 admin**（`server/src/modules/auth/auth.service.ts` 逻辑），之后注册的均为 student

管理员入口：`/admin`（单词管理、批量导入）

---

## 8. 验证清单

```bash
# 容器状态
docker compose ps

# 接口连通（应返回默认词库 JSON 数组）
curl -s http://localhost/api/vocabulary/lists | head -c 200

# 注册 + 登录 + 鉴权读取
curl -s -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test123456","full_name":"Admin"}'

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test123456"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s http://localhost/api/users/me -H "Authorization: Bearer $TOKEN" | head -c 200
```

浏览器侧检查：

- [ ] `http://<公网IP>` 能打开登录页
- [ ] 注册后进入 Dashboard
- [ ] 单词发音可播放（`/audio/*.mp3` 静态资源）
- [ ] 管理页 `/admin` 可添加单词
- [ ] 完成一次复习会话，积分增加

---

## 9. 日常更新发布

因为前端在本地构建，标准更新流程是**在开发机**执行一条命令：

```bash
cd "/Volumes/Macintosh HD/Users/work/poem/vocabquest"
./deploy/deploy-from-local.sh <公网IP> deploy
```

它会自动完成：本地 `pnpm build:prod` → 同步 `dist`/`server`/`deploy`/`docker-compose.yml` → 远程 `docker compose up -d --build`。

手动分步执行（需要精细控制时）：

```bash
# 1) 本地构建
./deploy/build-web.sh

# 2) 上传
rsync -av --delete dist/ deploy@<公网IP>:/home/deploy/vocabquest/dist/

# 3) 服务器上重建前端（后端代码变更时一并重建 api）
ssh deploy@<公网IP> "cd /home/deploy/vocabquest && docker compose --env-file .env.deploy up -d --build web"
```

> 只改后端时无需本地构建，直接同步 `server/` 后 `up -d --build api` 即可。

> 修改 `.env.deploy` 后需强制重建容器才会生效：
> `docker compose --env-file .env.deploy up -d --force-recreate`

**数据库结构变更**（当前 `synchronize: false`，需手动执行 SQL）：

```bash
docker compose exec -T postgres psql -U postgres -d vocabquest < server/db/新迁移.sql
```

---

## 10. 数据备份

```bash
mkdir -p /home/deploy/backups
cat > /home/deploy/backup.sh <<'EOF'
#!/bin/bash
cd /home/deploy/vocabquest
docker compose exec -T postgres pg_dump -U postgres vocabquest \
  | gzip > /home/deploy/backups/vocabquest_$(date +%F).sql.gz
find /home/deploy/backups -name "*.sql.gz" -mtime +14 -delete
EOF
chmod +x /home/deploy/backup.sh

echo "0 3 * * * deploy /home/deploy/backup.sh" >> /etc/crontab
```

恢复：

```bash
gunzip -c /home/deploy/backups/vocabquest_2026-09-09.sql.gz \
  | docker compose exec -T postgres psql -U postgres vocabquest
```

可选：用 `ossutil` 把备份同步到 OSS，避免整机故障丢数据。

---

## 11. 运维命令

```bash
docker compose logs -f --tail 100 api   # 查看日志
docker compose restart api              # 重启单个服务
docker stats                            # 资源占用
docker compose down                     # 停止（数据卷保留）
docker system prune -a                  # 清理无用镜像释放磁盘
```

---

## 12. 故障排查

| 现象 | 原因与处理 |
|---|---|
| 浏览器打不开 80 端口 | 大陆节点未备案时可能被拦截。改 `docker-compose.yml` 中 web 为 `'8080:80'`，重新 `up -d`，用 `http://<IP>:8080` 访问 |
| `docker compose up` 卡在拉取镜像 | 未配置镜像加速器，检查 `/etc/docker/daemon.json` |
| `COPY dist: no such file or directory` | 未执行本地构建，先跑 `./deploy/build-web.sh` |
| 前端构建失败 / 被 kill | 本地内存不足时关闭其他应用；或改回服务器端构建并升配到 8G |
| api 反复重启，日志 "role postgres does not exist" | `.env.deploy` 未生效，确认已 `--env-file` 且字段名正确 |
| 接口 401 | Token 过期或 `JWT_SECRET` 变更后未重新登录 |
| Postgres 起不来 | `docker compose logs postgres`，确认数据卷权限 |
| 想重新初始化数据库 | `docker compose down -v` 删除 pgdata 卷（**数据全丢**），再启动 |

---

## 13. 已知限制

- **AI 生成不可用**：ECS 无法访问 Gemini，`/api/ai/generate-word` 返回 503。管理页的"AI 生成"和"Simple 格式批量导入"暂不可用；CSV 导入与手动添加正常。需替换为国内大模型（通义千问 / DeepSeek / 豆包）或自建代理。
- **数据仅单机**：Postgres 以容器 + 本地卷运行，无高可用。建议配置第 10 节的定时备份，或后期迁移到阿里云 RDS PostgreSQL。

---

## 14. 升级到域名 + HTTPS

直接参照 `deploy-domain-https.md`，无需改动业务代码，只涉及：域名解析 → 备案 → 申请证书 → 换成 HTTPS 版 nginx 配置。
