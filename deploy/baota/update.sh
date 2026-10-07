#!/usr/bin/env bash
# Each invocation completes one durable stage. Process control stays in Baota.
set -euo pipefail

BAYSIDE_DIR="${1:-/www/bayside-city}"
BAYSIDE_PHASE=''
BAYSIDE_ACTIVE=''
BAYSIDE_PREPARED=''
BAYSIDE_TOOL=''

say() { printf '%s\n' "$*"; }
fail() { say "更新已停止：$*" >&2; exit 1; }
trap 'say "已中断。已完成的阶段保存在 update-state.json；若操作仍在后台运行，请等待底层更新锁释放后再试。" >&2; exit 130' HUP INT TERM

command -v node >/dev/null 2>&1 || fail '没有找到 Node.js。请先在宝塔设置 Node 24 或更新版本为命令行版本。'
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' || fail '需要 Node.js 24 或更新版本。'
[[ -d "$BAYSIDE_DIR" ]] || fail "找不到项目目录：$BAYSIDE_DIR"
[[ -f "$BAYSIDE_DIR/production.env" ]] || fail '找不到 production.env；请保留现有服务器配置。'
BAYSIDE_DIR="$(cd "$BAYSIDE_DIR" && pwd -P)"
# There is no shell lock or waiting shell between Baota actions. The update.mjs
# tool owns the mutation lock and rechecks persisted state before every action.
# Legacy .update-wizard-lock directories therefore need not be removed. Never
# remove or bypass the tool's .update-lock: an old updater may still be writing.

select_tool() {
  if [[ -f "$BAYSIDE_DIR/app/deploy/baota/update.mjs" ]]; then
    BAYSIDE_TOOL="$BAYSIDE_DIR/app/deploy/baota/update.mjs"
  elif [[ -f "$BAYSIDE_DIR/installer/deploy/baota/update.mjs" ]]; then
    BAYSIDE_TOOL="$BAYSIDE_DIR/installer/deploy/baota/update.mjs"
  else
    fail '找不到更新工具。请先按首次部署说明提取新版包中的 deploy 目录。'
  fi
}
read_state() {
  local metadata
  metadata="$(node --input-type=module - "$BAYSIDE_DIR" <<'JS'
import {readFileSync} from 'node:fs';
import path from 'node:path';
let state={};
try{state=JSON.parse(readFileSync(path.join(process.argv[2],'update-state.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('更新记录无法读取，请先检查 update-state.json');}
if(!['','prepared','awaiting-verification','verified','rolled-back'].includes(state.phase||''))throw Error('无法识别更新阶段，请检查 update-state.json');
for(const key of ['active','prepared'])if(state[key]&&!/^(legacy|bayside-[\w-]+)$/.test(state[key]))throw Error('更新记录中的版本号无效');
if(state.phase==='prepared'&&!/^bayside-[\w-]+$/.test(state.prepared||''))throw Error('准备阶段缺少待切换版本');
if(state.phase==='awaiting-verification'&&!/^bayside-[\w-]+$/.test(state.active||''))throw Error('验收阶段缺少已切换版本');
console.log([state.phase||'',state.active||'',state.prepared||''].join('|'));
JS
)" || fail '读取更新记录失败，未继续操作。'
  IFS='|' read -r BAYSIDE_PHASE BAYSIDE_ACTIVE BAYSIDE_PREPARED <<< "$metadata"
}
step() {
  select_tool
  if ! node "$BAYSIDE_TOOL" "$@" --base "$BAYSIDE_DIR"; then
    say '以上步骤没有通过，后续操作已停止。排查提示后，重新运行本脚本即可继续。' >&2
    exit 1
  fi
}
next_baota_action() {
  local action="$1"
  say ''
  say "请到宝塔 → 网站 → Node项目 → bayside-city，${action}项目。"
  say '本阶段已完成，向导现在退出。可以离开或关闭终端，不需要等待回车。'
  say '完成宝塔操作后，重新打开终端，运行同一条命令继续：'
  if [[ "$BAYSIDE_DIR" == '/www/bayside-city' ]]; then
    say '  bash /www/bayside-city/update.sh'
  else
    printf '  bash %q %q\n' "$BAYSIDE_DIR/update.sh" "$BAYSIDE_DIR"
  fi
}

say '湾畔市 · 更新向导'
read_state
if [[ "$BAYSIDE_PHASE" != 'prepared' && "$BAYSIDE_PHASE" != 'awaiting-verification' ]]; then
  BAYSIDE_PACKAGE="$(node --input-type=module - "$BAYSIDE_DIR" <<'JS'
import {readdirSync,lstatSync} from 'node:fs';
import path from 'node:path';
const uploads=path.join(process.argv[2],'uploads');
let names=[];try{names=readdirSync(uploads);}catch(e){if(e.code!=='ENOENT')throw e;}
const packages=names.filter(n=>/^bayside-\d{8}T\d{6}Z\.tar\.gz$/.test(n)).filter(n=>lstatSync(path.join(uploads,n)).isFile()).sort();
if(!packages.length){console.error('uploads 里没有新版发布包，请先上传 bayside-时间戳.tar.gz。');process.exit(1);}
console.log(path.join(uploads,packages.at(-1)));
JS
)" || fail '还没有可用的发布包。'
  BAYSIDE_TARGET="${BAYSIDE_PACKAGE##*/}"
  BAYSIDE_TARGET="${BAYSIDE_TARGET%.tar.gz}"
  if [[ "$BAYSIDE_PHASE" == 'verified' && "$BAYSIDE_TARGET" == "$BAYSIDE_ACTIVE" ]]; then
    say "已经是最新上传的版本：${BAYSIDE_ACTIVE}。上传下一个新版包后再运行即可。"
    exit 0
  fi
  if [[ "$BAYSIDE_ACTIVE" =~ ^bayside-[0-9]{8}T[0-9]{6}Z$ && "$BAYSIDE_TARGET" < "$BAYSIDE_ACTIVE" ]]; then
    fail 'uploads 中只有更旧的版本。向导不会自动降级；需要回退时请使用专门的 rollback 步骤。'
  fi
  say "找到新版：$BAYSIDE_TARGET"
  say '正在检查发布包、安装依赖，并用存档副本测试迁移。当前项目可继续运行。'
  step prepare "$BAYSIDE_PACKAGE"
  read_state
  [[ "$BAYSIDE_PHASE" == 'prepared' && "$BAYSIDE_PREPARED" == "$BAYSIDE_TARGET" ]] || fail '准备结果与预期不一致，请检查 update-state.json。'
  say "已保存进度：版本 ${BAYSIDE_PREPARED} 准备完成。请先让正在玩的朋友暂停建设并离开城市。"
  next_baota_action '停止'
  exit 0
fi

if [[ "$BAYSIDE_PHASE" == 'prepared' ]]; then
  BAYSIDE_TARGET="$BAYSIDE_PREPARED"
  say "已恢复进度：版本 ${BAYSIDE_TARGET} 已准备，继续停机检查与程序切换。"
  say '若还未在宝塔停止项目，本步骤会拒绝切换，进度保留。'
  say '正在确认停机、备份最新存档并切换程序……'
  step activate
  read_state
  [[ "$BAYSIDE_PHASE" == 'awaiting-verification' && "$BAYSIDE_ACTIVE" == "$BAYSIDE_TARGET" ]] || fail '切换结果与预期不一致，请保留输出并检查更新记录。'
  say "已保存进度：程序版本已切换到 ${BAYSIDE_ACTIVE}，等待启动后验收。"
  next_baota_action '启动'
  exit 0
fi

if [[ "$BAYSIDE_PHASE" == 'awaiting-verification' ]]; then
  BAYSIDE_TARGET="$BAYSIDE_ACTIVE"
  say "已恢复进度：版本 ${BAYSIDE_TARGET} 已切换，继续启动验收。"
  say '请确认已在宝塔启动项目；若尚未就绪，启动后重新运行本命令即可。'
  say '正在检查本机服务与游戏域名……'
  step verify
  say ''
  say '更新完成！账号与城市存档已保留，请刷新游戏页面继续。'
else
  fail '更新没有进入预期阶段，请保留终端输出进行检查。'
fi
