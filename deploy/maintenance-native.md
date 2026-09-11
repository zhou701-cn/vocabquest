# 日常维护与发版更新（原生部署 · ECS 裸机 + PM2）

> 本文讲**部署完成之后**的日常运维与发版流程。首次从零部署见 `deploy-native.md`。
> 与 `deploy-ip-access.md`（Docker 方案）是两套环境，命令请勿混用。

---

## 1. 环境速查

| 项 | 值 |
|---|---|
| 部署用户 | `ubuntu`（sudo 免密） |
| 代码目录 | `/home/ubuntu/app`（git，分支 `domestic`） |
| 服务端目录 | `/home/ubuntu/app/server` |
| 前端静态目录 | `/home/ubuntu/web`（Vite 构建产物，本地上传） |
| Node | 18.x（原生） |
| PostgreSQL | 14（apt，仅 `localhost:5432`） |
| Nginx | 1.18（apt，80 → 3001 反代 + `/home/ubuntu/web` 静态） |
| PM2 进程 | `vocabquest-api`（开机自启已配） |
| 应用端口 | **3001**（全局前缀 `/api`） |
| 数据库 | `vocabquest`，属主 `appuser` |
| 环境变量 | `/home/ubuntu/app/server/.env` |

请求链路：`浏览器 → :80 (nginx) → /api/* → 127.0.0.1:3001 (NestJS) → localhost:5432 (postgres)`

---

## 2. 后端发版（改了 server 代码）

在**服务器**执行：

```bash
cd ~/app && git pull origin domestic
cd ~/app/server && npm install && npm run build && pm2 restart vocabquest-api && pm2 save
```

- 国内 npm 慢先设镜像：`npm config set registry https://registry.npmmirror.com`
- 只改了逻辑、依赖没变，可省略 `npm install`
- 看到 `pm2 logs vocabquest-api` 出现 `Nest application successfully started` 即成功

---

## 3. 前端发版（改了 web 代码）

在**本地 Mac**（仓库根目录）构建并上传：

```bash
cd "/Volumes/Macintosh HD/Users/work/poem/vocabquest"
pnpm build:prod
tar czf - -C dist . | ssh ubuntu@82.156.163.228 "tar xzf - -C /home/ubuntu/web"
```

- **无需 reload nginx**：静态文件直接生效；只有改了 `nginx.conf` 才需 `sudo systemctl reload nginx`
- 浏览器若缓存旧资源，硬刷新（Ctrl+Shift+R / Cmd+Shift+R）
- 老版本 `scp` 不支持 `dist/.`，故用 tar 管道；若用新 scp 也可 `scp -r dist/. ubuntu@<IP>:/home/ubuntu/web/`

---

## 4. 前后端一起发版

先跑第 2 节（后端），再跑第 3 节（前端）。

---

## 5. 只改了 `.env`

`.env` 在进程启动时读取，改完必须重启才生效：

```bash
cd ~/app/server && pm2 restart vocabquest-api
```

（如改了 `DB_PASSWORD` / `JWT_SECRET`，记得同时更新数据库用户密码或让用户重新登录。）

---

## 6. 数据库结构变更

当前 `synchronize: false`，改了实体后需**手动执行 SQL**（不能靠 TypeORM 自动建表）：

```bash
DATABASE_URL='postgresql://appuser:<DB_PASSWORD>@127.0.0.1:5432/vocabquest'
psql "$DATABASE_URL" -f ~/app/server/db/新迁移.sql
```

---

## 7. 备份与恢复

### 备份（postgres 超级用户，免密码）
```bash
mkdir -p ~/backups
sudo -u postgres pg_dump vocabquest | gzip > ~/backups/vocabquest_$(date +%F).sql.gz
```

### 定时备份（每天 3 点）
```bash
(crontab -l 2>/dev/null; echo "0 3 * * * sudo -u postgres pg_dump vocabquest | gzip > /home/ubuntu/backups/vocabquest_\$(date +\%F).sql.gz") | crontab -
```

### 恢复（会覆盖现有数据，先确认）
```bash
gunzip -c ~/backups/vocabquest_2026-09-11.sql.gz | sudo -u postgres psql vocabquest
```

---

## 8. 常用运维命令

```bash
# 应用
pm2 status
pm2 logs vocabquest-api --lines 50      # Ctrl+C 退出，不影响服务
pm2 restart vocabquest-api
pm2 stop vocabquest-api
pm2 save                                 # 固化进程列表，重启后 pm2 resurrect 可恢复

# 系统服务
systemctl status nginx postgresql
sudo nginx -t && sudo systemctl reload nginx

# 端口监听
ss -ltnp | grep -E ':(80|3001|5432)'
```

> PM2 已 `pm2 startup`（systemd）。若服务器重启后进程没起：`pm2 resurrect`。

---

## 9. 故障排查

| 现象 | 原因与处理 |
|---|---|
| 网页 500 | `/home/ubuntu` 是 750，Nginx 的 www-data 进不去：`chmod 755 /home/ubuntu` |
| 浏览器打不开 80 | 安全组未放行 80；或 `systemctl status nginx` 看是否挂了 |
| 接口 502 | NestJS 没起：`pm2 logs vocabquest-api`；确认 3001 在监听 |
| 接口 404（仅 `/api` 裸路径） | 正常，应用无裸 `/api` 路由，接口都在 `/api/xxx` |
| 接口 401 | Token 过期，或 `JWT_SECRET` 改过后未重新登录 |
| 改代码不生效 | 忘了 `npm run build` 或 `pm2 restart` |
| 服务器重启后应用没起 | `pm2 status` 为空则 `pm2 resurrect`；确认 `pm2 startup` 已执行 |
| 数据库连接失败 | 检查 `~/app/server/.env` 的 `DB_*`；`sudo -u postgres psql -c '\du'` 确认 `appuser` 存在 |
| AI 接口 503 | ECS 访问不了 Gemini，`GEMINI_API_KEY` 留空即返回 503，属预期 |
| `nginx -t` 报 Permission denied | 漏了 `sudo`，用 `sudo nginx -t` |

---

## 10. 安全要点

- PostgreSQL 仅监听 `localhost`，安全组**不要**开放 5432。
- `~/app/server/.env` 含 `DB_PASSWORD` / `JWT_SECRET`，**不要**提交进 git。
- 用 SSH 密钥登录（已免密）；要更高安全可把安全组 22 限制来源 IP。
- 上线 HTTPS 需自备域名，参照 `deploy-domain-https.md`（Nginx 换 443 + certbot，业务代码无需改）。
- 怀疑密钥泄露：`openssl rand -base64 48` 重新生成 `JWT_SECRET` 并 `pm2 restart`。

---

## 11. 与 Docker 方案的区别

`deploy-ip-access.md` / `setup-ecs.sh` / `deploy-from-local.sh` 描述的是 **Docker Compose** 部署
（容器用户 `deploy`、postgres 容器、前端在开发机构建后上传）。本机实际用的是上面这套
**原生部署**（apt 装 PostgreSQL/Nginx、Node 原生、PM2 守护），请以本文与 `deploy-native.md` 为准。
