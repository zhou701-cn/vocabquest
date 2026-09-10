# 前端镜像：只承载「本地已构建好」的静态产物（dist），不在服务器上执行 Node 构建。
#
# 为什么这么做：
#   vite build 内存峰值 2-3G，在 2 核 4G 的 ECS 上容易 OOM。
#   把构建放到开发机后，服务器只需跑 nginx，4G 内存绰绰有余（省一半机器钱）。
#
# 构建前请在本地先执行：./deploy/build-web.sh
# 镜像构建：docker build -t vocabquest-web .

FROM nginx:alpine

COPY dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
