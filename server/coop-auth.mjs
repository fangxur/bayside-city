import {randomBytes, randomUUID, createHash, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const reject = (message, status = 400, code = 'INVALID') => { throw Object.assign(Error(message), {status, code}); };
const DAY = 86400000;
let hashing = 0;
function username(value) {
 if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(value)) reject('账号名需为 3～24 位字母、数字或下划线');
 return value.toLowerCase();
}
function password(value) {
 if (typeof value !== 'string' || [...value].length < 10 || value.length > 128) reject('密码请使用 10～128 个字符');
 return value;
}
async function hashPassword(value, salt) {
 if (hashing >= 4) reject('登录服务繁忙，请稍后再试', 429);
 hashing++;
 try { return Buffer.from(await derive(value, salt, 32, {N:32768, r:8, p:3, maxmem:64*1024*1024})).toString('hex'); }
 finally { hashing--; }
}
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class CoopAuth {
 constructor(store) {
  this.store = store; this.db = store.db;
  // Additive migration: all existing actor IDs, memberships, command receipts and logs survive.
  store.transaction(() => this.db.exec(`
   CREATE TABLE IF NOT EXISTS accounts(actor TEXT PRIMARY KEY REFERENCES users(id), username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS auth_sessions(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, actor TEXT NOT NULL REFERENCES accounts(actor), device TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL, expires INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS auth_sessions_actor ON auth_sessions(actor);
  `));
  this.attempts = new Map();
 }
 limit(key, max = 12) {
  const now = this.store.now();
  for (const [k, item] of this.attempts) if (item.until <= now) this.attempts.delete(k);
  const item = this.attempts.get(key) || {count:0, until:now+15*60000};
  if (item.count >= max || (!this.attempts.has(key) && this.attempts.size >= 10000)) reject('尝试过于频繁，请 15 分钟后重试', 429);
  item.count++; this.attempts.set(key, item);
 }
 issue(actor, device) {
  const token = secret(), now = this.store.now(), id = randomUUID();
  this.db.prepare('DELETE FROM auth_sessions WHERE expires<=?').run(now);
  if (this.db.prepare('SELECT count(*) AS n FROM auth_sessions WHERE actor=?').get(actor).n >= 20) reject('登录设备已达 20 台，请先在账号设置中退出旧设备');
  this.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?,?,?)').run(id, digest(token), actor, String(device || '浏览器').slice(0,120), now, now, now+30*DAY);
  return {token, ...this.resolve(token)};
 }
 resolve(token) {
  if (typeof token !== 'string' || token.length > 128) reject('请先登录你的小城账号', 401, 'AUTH');
  const row = this.db.prepare('SELECT s.*,a.username,u.name FROM auth_sessions s JOIN accounts a ON a.actor=s.actor JOIN users u ON u.id=s.actor WHERE s.token_hash=? AND s.expires>?').get(digest(token), this.store.now());
  if (!row) reject('登录已过期，请重新登录；城市进度仍保存在服务器', 401, 'AUTH');
  if (row.seen < this.store.now()-60000) this.db.prepare('UPDATE auth_sessions SET seen=? WHERE id=?').run(this.store.now(), row.id);
  return {actor:{id:row.actor, name:row.name}, account:{username:row.username}, sessionId:row.id};
 }
 async register(data, guestToken, device) {
  const name = username(data.username), pass = password(data.password);
  // A guest may only be bound by proving possession of that guest's original credential.
  const guest = guestToken ? this.store.user(guestToken) : null;
  if (!guest && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 24)) reject('请输入 1～24 字的玩家名字');
  if (this.db.prepare('SELECT 1 FROM accounts WHERE username=?').get(name)) reject('这个账号名已被使用', 409);
  const salt = secret(), hash = await hashPassword(pass, salt), recoveryCode = secret();
  return this.store.transaction(() => {
   const actor = guest ? this.store.user(guestToken) : this.store.session(data.name).actor;
   if (this.db.prepare('SELECT 1 FROM accounts WHERE username=? OR actor=?').get(name, actor.id)) reject('账号名已被使用或此玩家已经绑定账号', 409);
   this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run(actor.id, name, salt, hash, digest(recoveryCode), this.store.now());
   // Retire the transferable guest credential once the player has a password-protected account.
   this.db.prepare('UPDATE users SET secret=? WHERE id=?').run(digest(secret()), actor.id);
   return {...this.issue(actor.id, device), recoveryCode};
  });
 }
 async login(data, device) {
  const name = username(data.username), pass = password(data.password);
  this.limit('login:'+name);
  const row = this.db.prepare('SELECT * FROM accounts WHERE username=?').get(name);
  const hash = await hashPassword(pass, row?.salt || 'bayside-missing-account');
  if (!row || !equal(hash, row.password_hash)) reject('账号名或密码不正确', 401, 'LOGIN');
  return this.store.transaction(() => {
   const current = this.db.prepare('SELECT password_hash FROM accounts WHERE actor=?').get(row.actor);
   if (!equal(current?.password_hash, hash)) reject('密码已变更，请重新登录', 401, 'LOGIN');
   const result = this.issue(row.actor, device); this.attempts.delete('login:'+name); return result;
  });
 }
 async reset(data, device) {
  const name = username(data.username), pass = password(data.password);
  this.limit('reset:'+name, 6);
  const row = this.db.prepare('SELECT * FROM accounts WHERE username=?').get(name);
  if (!row || typeof data.recoveryCode !== 'string' || data.recoveryCode.length > 128 || !equal(row.recovery_hash, digest(data.recoveryCode.trim()))) reject('账号名或恢复码不正确', 401, 'LOGIN');
  const salt = secret(), hash = await hashPassword(pass, salt), recoveryCode = secret();
  return this.store.transaction(() => {
   const current = this.db.prepare('SELECT recovery_hash FROM accounts WHERE actor=?').get(row.actor);
   if (!equal(current?.recovery_hash, row.recovery_hash)) reject('恢复码已使用，请使用最新恢复码', 401, 'LOGIN');
   this.db.prepare('UPDATE accounts SET salt=?,password_hash=?,recovery_hash=? WHERE actor=?').run(salt, hash, digest(recoveryCode), row.actor);
   this.db.prepare('DELETE FROM auth_sessions WHERE actor=?').run(row.actor);
   return {...this.issue(row.actor, device), recoveryCode};
  });
 }
 async changePassword(auth, data, device) {
  this.limit('password:'+auth.actor.id);
  const row = this.db.prepare('SELECT * FROM accounts WHERE actor=?').get(auth.actor.id);
  const previous = await hashPassword(password(data.currentPassword), row.salt);
  if (!equal(previous, row.password_hash)) reject('当前密码不正确', 401, 'PASSWORD');
  const salt = secret(), hash = await hashPassword(password(data.password), salt), recoveryCode = secret();
  return this.store.transaction(() => {
   const current = this.db.prepare('SELECT password_hash FROM accounts WHERE actor=?').get(auth.actor.id);
   const session = this.db.prepare('SELECT 1 FROM auth_sessions WHERE id=? AND expires>?').get(auth.sessionId,this.store.now());
   if (!session || !equal(current?.password_hash, previous)) reject('登录状态已变更，请重新登录',401,'AUTH');
   this.db.prepare('UPDATE accounts SET salt=?,password_hash=?,recovery_hash=? WHERE actor=?').run(salt, hash, digest(recoveryCode), auth.actor.id);
   this.db.prepare('DELETE FROM auth_sessions WHERE actor=?').run(auth.actor.id);
   return {...this.issue(auth.actor.id, device), recoveryCode};
  });
 }
 sessions(auth) {
  return this.db.prepare('SELECT id,device,created,seen,expires FROM auth_sessions WHERE actor=? AND expires>? ORDER BY seen DESC').all(auth.actor.id,this.store.now()).map(s=>({...s,current:s.id===auth.sessionId}));
 }
 logout(auth, id = auth.sessionId) {
  this.db.prepare('DELETE FROM auth_sessions WHERE actor=? AND id=?').run(auth.actor.id, id);
  return {ok:true};
 }
}
