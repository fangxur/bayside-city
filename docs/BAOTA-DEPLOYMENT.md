# 宝塔部署：好友共建测试

准备的游戏地址：`https://city.yunyousl.com.cn`。这是建议的独立子域名，尚未创建 DNS 或上线。
`www.yunyousl.com.cn` 已有公司官网；以下操作只针对新建的游戏站点。

## 1. DNS 和 HTTPS

在 `yunyousl.com.cn` 的域名解析中添加一条 `A` 记录，主机记录填 `city`，记录值填宝塔所在服务器的实际公网 IPv4。也可以用 `CNAME` 指向已确认由同一服务器承载的 `www.yunyousl.com.cn`，二选一。

在宝塔为 `city.yunyousl.com.cn` 新建独立站点。解析生效后，申请包含 **city 子域名**的证书并启用 HTTPS。仅有 www 的证书通常不能用于 city。保留宝塔生成的证书续签配置。

## 2. 文件和持久化目录

建议目录：

| 目录 | 用途 |
| --- | --- |
| `/www/bayside-city/app` | 本项目源代码，可更新替换 |
| `/www/bayside-data` | SQLite 正式存档，保留不覆盖 |
| `/www/bayside-backups` | 独立数据库备份，保留不覆盖 |

上传项目源码及 `package-lock.json`。不要上传本地的 `node_modules`、`.bayside-data`、`artifacts` 或已有玩家身份凭据。
代码与数据都不作为 PHP/HTML 静态站点根目录开放；页面和 API 统一转发给 Node 服务。

在宝塔安装 Node.js 24 或更高版本，将所用终端和项目都切换到这个版本。进入代码目录后执行：

```sh
cd /www/bayside-city/app
node -v
npm ci --omit=dev
```

提前创建存档与备份目录，并让游戏实际运行用户（建议专用用户或宝塔的 www 用户）拥有写入权限。SQLite 需要在数据库所在目录创建 `-wal` 和 `-shm` 文件；不要只给 `.sqlite` 文件写权限。

## 3. 启动 Node 服务（二选一）

**方式 A：宝塔 Node 项目。**添加项目，工作目录填 `/www/bayside-city/app`，Node 版本选 24+。将下面变量保存在 `/www/bayside-city/production.env`（root:www、权限 640），自定义启动命令填 `node --env-file=/www/bayside-city/production.env server.mjs`，再开启进程守护、开机启动：

```text
NODE_ENV=production
HOST=127.0.0.1
PORT=4173
PUBLIC_ORIGIN=https://city.yunyousl.com.cn
COOP_DB=/www/bayside-data/cities.sqlite
COOP_BACKUP_DIR=/www/bayside-backups
```

这些变量需要实际传给 Node 进程；本项目不会自动读取普通 `.env` 文件。

**方式 B：PM2。**项目带有 `deploy/baota/ecosystem.config.cjs`。在已安装 PM2、使用正确 Node 版本的终端执行：

```sh
cd /www/bayside-city/app
pm2 start deploy/baota/ecosystem.config.cjs
pm2 save
```

再按宝塔或 `pm2 startup` 的提示配置开机恢复。PM2 应运行在同一应用用户下，避免重启时切换到另一套进程清单。不要再用方式 A 启动第二份服务。第一版保持单实例 fork 模式，所有成员访问同一数据库。

## 4. Nginx 反向代理

在 **city 游戏站点**配置反向代理：代理目录 `/`，目标 `http://127.0.0.1:4173`，发送域名保留客户端 Host，关闭代理缓存。页面与 `/api/` 都走同一站点，不需要跨域配置或 WebSocket。

若手动编辑 Nginx，可参考 `deploy/baota/nginx-location.conf`。它是放在现有 `server {}` 内的片段：替换原有 `location /`，不能直接覆盖整个站点配置。移除会抢先处理 JS/CSS/图片的通用缓存 location；保留 SSL、域名、日志和 `/.well-known/` 证书验证配置。保存前使用宝塔的配置检测或 `nginx -t`。

Node 的 4173 端口只监听本机。朋友通过游戏域名的 HTTPS 访问，不需要在云安全组开放 4173。`PUBLIC_ORIGIN` 必须与浏览器最终地址完全匹配，包括协议和非默认端口；更换域名后修改并重启进程。

后端校验明确配置的公开域名，不信任任意 `X-Forwarded-*` 请求头，也不需要开放 `Access-Control-Allow-Origin: *`。

## 5. 两人验收

1. 两台电脑，或两个不同浏览器，打开游戏子域名并各自注册独立账号。同一账号跨设备使用相同身份；同一浏览器的普通标签页共用登录状态。
2. 房主创建合作城市、生成邀请；另一位玩家使用邀请加入。房主控制继续和暂停。
3. 同时在不同地块建设：两边都应看到结果；争用同一位置时只有成功的一次扣费。
4. 断开其中一人的网络：界面只读。重新连接后恢复正式进度，不覆盖队友成果。
5. 保存纪念存档，关闭页面再进入，确认城市与日志存在。重启 Node 服务后再次检查。
6. 若已有本地单人城市，先导出 JSON，再在新域名导入、复制成合作城。本地浏览器数据不会自动迁移到服务器域名。
7. 保存各自的账号恢复卡；用第二台设备登录相同账号，确认城市、角色和建设记录一致。旧版玩家先在原浏览器绑定账号。

## 6. 备份和代码更新

运行中每 5 分钟生成经完整性检查的完整 SQLite 备份，保留最近 24 份。手动备份应使用与运行进程相同的路径（PM2 环境变量不会自动传给另一个终端）：

```sh
cd /www/bayside-city/app
COOP_DB=/www/bayside-data/cities.sqlite COOP_BACKUP_DIR=/www/bayside-backups npm run backup:coop
```

使用宝塔计划任务把已经生成的备份文件复制到其他磁盘或对象存储。不要只复制运行中的 `cities.sqlite`，也不要依赖压缩源码目录备份城市。

已上线项目请使用 [账号与版本更新说明](ACCOUNTS-AND-UPDATES.md) 中的发布包和更新工具。它会检查文件、在数据库副本上试迁移、停机后备份最新进度，再切换程序。不要覆盖上传到正在运行的 app 目录。

游戏内恢复历史版本会先生成备份并阻止旧分支请求，是日常恢复的优先方式。整库灾难恢复请遵循 README 中的离线恢复步骤。

当前版本适合 2～4 人好友小规模测试。支持账号密码、旧身份绑定和多设备登录；部署工具不会替你修改 DNS、SSL、Nginx 或其他网站。首次部署需逐项完成这些配置。
