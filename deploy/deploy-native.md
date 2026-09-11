# 完整部署手册（原生部署 · ECS 裸机 + PM2）

> 适用：把 VocabQuest 直接部署到腾讯云 ECS（Ubuntu），**不使用 Docker**。
> 部署完成后的日常运维与发版见 `maintenance-native.md`。
> 本文与 `deploy-ip-access.md`（Docker 方案）是两套环境，**命令请勿混用**。

---

## 0. 架构概览

```
浏览器 ──http://<IP>:80──▶ Nginx (原生, /etc/nginx)
   ├─ /        ─▶ 静态网页 (/home/ubuntu/web，Vite 构建产物)
   └─ /api/*   ─▶ 127.0.0.1:3001 (NestJS, PM2 进程 vocabquest-api)
                     └─ localhost:5432 (PostgreSQL, 仅本机, 用户 appuser / 库 vocabquest)
```

| 服务 | 端口 | 对外 | 说明 |
|---|---|---|---|
| Nginx | 80 | 是 | 静态资源 + `/api` 反代 |
| NestJS (PM2) | 3001 | 否 | 由 Nginx 反代，不直接暴露 |
| PostgreSQL | 5432 | **否** | 仅监听 localhost |

---

## 1. 准备工作

### 1.1 ECS 与网络
- 镜像：**Ubuntu 22.04 LTS**；规格建议 2 核 4G 起。
- **安全组入站**放行：`22`(SSH)、`80`(HTTP)；`5432` **不要放行**；`443` 待上 HTTPS 再加。

### 1.2 SSH 免密登录（本地 Mac）
```bash
ssh-keygen -t ed25519 -C "ecs-deploy"
cat ~/.ssh/id_ed25519.pub
```
把公钥追加到服务器 `~/.ssh/authorized_keys`（或服务器执行 `ssh-copy-id ubuntu@<IP>`）。
验证：`ssh ubuntu@<IP>` 应能免密进入。

---

## 2. 安装运行时（服务器，ubuntu 用户）

### 2.1 Node 18（NodeSource，NestJS 10 兼容）
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
node -v && npm -v
```

### 2.2 PostgreSQL（apt，仅本机）
```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
psql --version
```
建库与用户（`<DB_PASSWORD>` 换成强密码，**不要含 `!`**，或先 `set +H`）：
```bash
sudo -u postgres psql -c "CREATE USER appuser WITH PASSWORD '<DB_PASSWORD>' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE vocabquest OWNER appuser;"
```

### 2.3 Nginx
```bash
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.4 PM2
```bash
sudo npm install -g pm2
pm2 startup          # 复制它打印的 sudo 命令执行一次，启用开机自启
pm2 save
```

### 2.5 git 部署密钥
```bash
ssh-keygen -t ed25519 -C "ecs-deploy"
cat ~/.ssh/id_ed25519.pub   # 加到 GitHub 仓库的 Deploy Keys（只读即可）
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
```

---

## 3. 后端部署

```bash
mkdir -p ~/app
cd ~/app && git clone -b domestic git@github.com:zhou701-cn/vocabquest.git .
git checkout -b domestic origin/domestic     # clone -b 偶尔是游离 HEAD，建正式分支跟踪

cd ~/app/server
npm config set registry https://registry.npmmirror.com
npm install
npm run build
```

写 `.env`（密码 / JWT 用真实值，下面为占位）：
```bash
set +H
JWT_SECRET=$(openssl rand -base64 48)
cat > ~/app/server/.env <<EOF
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=appuser
DB_PASSWORD=<DB_PASSWORD>
DB_NAME=vocabquest
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
PORT=3001
GEMINI_API_KEY=
EOF
```

初始化表结构（以 appuser 跑，表归其所有）：
```bash
DATABASE_URL='postgresql://appuser:<DB_PASSWORD>@127.0.0.1:5432/vocabquest'
psql "$DATABASE_URL" -f ~/app/server/db/schema.sql
```

启动：
```bash
cd ~/app/server
pm2 start dist/main.js --name vocabquest-api
pm2 save
```

---

## 4. Nginx 反代（先只配 API）

```bash
sudo tee /etc/nginx/sites-available/app > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. 前端部署（本地构建 + 上传）

本地 Mac（仓库根目录）：
```bash
cd "/Volumes/Macintosh HD/Users/work/poem/vocabquest"
pnpm build:prod
```
服务器建目录：
```bash
mkdir -p /home/ubuntu/web
```
本地 Mac 上传（老版本 scp 不支持 `dist/.`，用 tar 管道最稳）：
```bash
tar czf - -C dist . | ssh ubuntu@82.156.163.228 "tar xzf - -C /home/ubuntu/web"
```

改写 Nginx：静态网页 + `/api` 反代：
```bash
sudo tee /etc/nginx/sites-available/app > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    root /home/ubuntu/web;
    index index.html;
    location / {
        try_files $uri /index.html;
    }
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
sudo nginx -t
sudo systemctl reload nginx
```

⚠️ **关键权限**：Nginx 工作进程（www-data）需能进入 `/home/ubuntu`，否则网页返回 500：
```bash
chmod 755 /home/ubuntu
```

---

## 6. 验证

本地 Mac：
```bash
curl -I http://82.156.163.228/                            # 期望 200, Content-Type: text/html
curl -s http://82.156.163.228/api/poems/library | head -c 200   # 期望 JSON（未登录返回 401 也说明链路通）
```
浏览器打开 `http://82.156.163.228` 即完整网页；注册第一个账号自动成为 admin。

---

## 7. 常见问题

| 现象 | 处理 |
|---|---|
| 网页 500 | `/home/ubuntu` 权限是 750，执行 `chmod 755 /home/ubuntu` |
| clone 报 `Permission denied (publickey)` | Deploy Key 没配对 / 加错仓库 |
| 接口 502 | PM2 没起：`pm2 logs vocabquest-api` 看报错；确认 3001 在监听 |
| 建用户报 `event not found` | 密码含 `!`，先 `set +H` 再执行 |
| `nginx -t` 报 Permission denied | 漏了 `sudo`，用 `sudo nginx -t` |
| 接口返回 404（仅 `/api` 裸路径） | 正常，应用无裸 `/api` 路由，接口都在 `/api/xxx` |
