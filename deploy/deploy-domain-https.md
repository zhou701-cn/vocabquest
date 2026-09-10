# 部署方案 B：域名 + HTTPS（备案通过后的正式上线流程）

> 前置：建议先按 `deploy-ip-access.md` 用 IP 跑通整套环境，备案期间即可正常开发联调；备案通过后再执行本文的域名与证书配置。
> 本文只覆盖「域名接入 + HTTPS」部分，服务器初始化、Docker 安装、代码上传等通用步骤与方案 A 完全一致。

---

## 0. 前置条件清单

- [ ] ECS 已按 `deploy-ip-access.md` 第 1-6 节完成初始化并能通过 IP 访问
- [ ] 已在阿里云（或国内其他接入商）完成 **ICP 备案**，状态为"已备案"
- [ ] 域名已完成 **A 记录解析** 指向 ECS 公网 IP
- [ ] 安全组已放行 **80 与 443**（22 保持限制源 IP）

> **重要**：中国大陆节点未备案的域名，访问 80/443 会被阿里云直接拦截（返回阻断页）。只有备案通过后才能正常访问，IP 访问不受此限制。

---

## 1. 域名解析

在域名解析控制台添加记录：

| 类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | `@` | ECS 公网 IP | 10 分钟 |
| A | `www` | ECS 公网 IP | 10 分钟 |

验证解析生效：

```bash
ping -c 1 your.domain.com
# 或
nslookup your.domain.com
```

---

## 2. 备案（阿里云备案系统）

流程：`阿里云 ICP 代备案管理系统` → 填写主体信息 → 填写网站信息 → 阿里云初审（1-2 工作日）→ 短信核验 → 管局审核（约 10-20 天）。

注意事项：

- 域名需完成**实名认证**且实名信息与备案主体一致
- 网站名称不能含"中国""国家"等敏感词，个人备案不能出现企业/经营性内容
- 备案期间可用 `http://<公网IP>` 继续访问，不影响开发
- 备案通过后需在网站底部展示备案号（前端页脚加一行即可）

---

## 3. 申请 SSL 证书（二选一）

### 方式 A：阿里云免费证书（推荐，无需停机）

1. 阿里云控制台 → 数字证书管理服务 → SSL 证书 → 免费证书（每年 20 张）
2. 创建证书 → 填写域名 → DNS 验证（按提示加一条 TXT 解析）
3. 签发后**下载 Nginx 版**（得到 `xxx.pem` 和 `xxx.key`）
4. 上传到服务器：

```bash
sudo mkdir -p /etc/nginx/ssl
# 本地执行上传
scp your.domain.com.pem root@<公网IP>:/etc/nginx/ssl/
scp your.domain.com.key root@<公网IP>:/etc/nginx/ssl/
```

### 方式 B：Let's Encrypt（certbot，需临时占用 80 端口）

```bash
apt install -y certbot

# 先停掉占用 80 的 nginx 容器
cd /home/deploy/vocabquest && docker compose stop web

certbot certonly --standalone -d your.domain.com -d www.your.domain.com

docker compose start web
```

证书路径：`/etc/letsencrypt/live/your.domain.com/fullchain.pem` 与 `privkey.pem`

---

## 4. 配置 HTTPS 版 nginx

项目已提供模板 `deploy/nginx-ssl.conf`，按需修改其中的域名与证书路径：

```bash
cd /home/deploy/vocabquest
cp deploy/nginx-ssl.conf deploy/nginx-ssl.conf.local   # 可选：保留一份本地修改
vim deploy/nginx-ssl.conf
```

需要修改的位置：

- `server_name your.domain.com;` → 你的域名
- 阿里云证书：`ssl_certificate /etc/nginx/ssl/your.domain.com.pem;`
- Let's Encrypt：`ssl_certificate /etc/letsencrypt/live/your.domain.com/fullchain.pem;`

然后修改 `docker-compose.yml` 中 `web` 服务，增加 443 端口与证书挂载：

```yaml
  web:
    build: .
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      # 阿里云证书
      - /etc/nginx/ssl:/etc/nginx/ssl:ro
      # 若用 Let's Encrypt 则改用下面这行
      # - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./deploy/nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
```

重启生效：

```bash
docker compose --env-file .env.deploy up -d --build web
docker compose logs -f web
```

---

## 5. 证书自动续期

**Let's Encrypt（90 天有效期）**：

```bash
# 先测试续期流程是否正常
certbot renew --dry-run

# 加入定时任务：每天凌晨 3 点检查，续期后自动重启 web
cat > /usr/local/bin/renew-cert.sh <<'EOF'
#!/bin/bash
certbot renew --quiet --deploy-hook "cd /home/deploy/vocabquest && docker compose restart web"
EOF
chmod +x /usr/local/bin/renew-cert.sh
echo "0 3 * * * root /usr/local/bin/renew-cert.sh" >> /etc/crontab
```

**阿里云免费证书（1 年有效期）**：控制台不自动续签，需每年手动重新申请并替换 `/etc/nginx/ssl/` 下的文件，然后 `docker compose restart web`。可设置日历提醒，或改用 certbot 自动续期。

---

## 6. 验证清单

```bash
# HTTPS 访问
curl -I https://your.domain.com          # 应返回 200

# HTTP 自动跳转 HTTPS
curl -I http://your.domain.com           # 应返回 301 → https

# 证书信息
echo | openssl s_client -connect your.domain.com:443 -servername your.domain.com 2>/dev/null \
  | openssl x509 -noissue -dates -subject

# 接口经 HTTPS 正常
curl -s https://your.domain.com/api/vocabulary/lists | head -c 200
```

浏览器侧检查：

- [ ] 地址栏显示锁标志，无"不安全"提示
- [ ] `http://` 访问自动跳转 `https://`
- [ ] 登录、复习、管理页功能正常
- [ ] 音频可播放（无混合内容告警）
- [ ] 控制台无 Mixed Content 报错

---

## 7. 前端需同步调整（可选）

如果 API 使用独立域名（如 `api.your.domain.com`），需在构建时指定：

```bash
VITE_API_BASE_URL=https://api.your.domain.com/api pnpm build
```

当前架构下 API 与页面同域（`/api` 由 nginx 反代），**无需任何前端改动**。

备案号展示：在前端页脚添加备案号链接（指向 `https://beian.miit.gov.cn`）。

---

## 8. 日常更新发布

与方案 A 相同，**推荐直接在开发机执行一键脚本**（会本地构建 `dist` 并同步，证书配置不受影响）：

```bash
cd "/Volumes/Macintosh HD/Users/work/poem/vocabquest"
./deploy/deploy-from-local.sh <公网IP> deploy
```

或在服务器上手动更新（仅后端变更时）：

```bash
cd /home/deploy/vocabquest
git pull
docker compose --env-file .env.deploy up -d --build api
```

> 注意：重建 `web` 服务会重新挂载 `nginx-ssl.conf`，确保该文件未被 `git pull` 覆盖回模板内容（建议用 `nginx-ssl.conf.local` 并在 compose 中指向它）。

---

## 9. 常见坑

| 现象 | 原因与处理 |
|---|---|
| 访问域名出现"未备案"阻断页 | 备案未完成或域名未接入阿里云备案；备案期间用 IP 访问 |
| 证书不信任 / 域名不匹配 | 证书绑定的域名与访问域名不一致，检查 `server_name` 与证书 CN/SAN |
| nginx 启动报 `cannot load certificate` | 证书路径在容器内不存在，确认 volume 已挂载且路径正确 |
| 437/重定向循环 | 后端未正确识别 HTTPS，确认 `proxy_set_header X-Forwarded-Proto $scheme;` 存在 |
| 页面资源被浏览器拦截（Mixed Content） | 前端硬编码了 `http://` 资源，改为相对路径或 `https://` |
| 443 端口不通 | 安全组未放行 443，或 ufw 未 allow 443：`ufw allow 443` |
| 续期失败 | 80 端口被 nginx 容器占用导致 standalone 验证失败，先 `docker compose stop web` 再续期 |

---

## 10. 安全加固建议

- 开启 HSTS（模板中已注释，确认稳定后启用）
- SSH 改为密钥登录、禁用密码登录，端口可改非 22
- 定期 `apt upgrade` 与镜像更新
- 开启阿里云云监控告警（CPU、内存、磁盘）
- 数据库定时备份并同步到 OSS（见 `deploy-ip-access.md` 第 10 节）
