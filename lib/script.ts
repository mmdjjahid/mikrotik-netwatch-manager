import { getDb } from './db';
import { getSetting } from './settings';
import { decrypt } from './crypto';

export interface BuildScriptParams {
  name: string;
  host: string;
  tokenOrEnc: string;
  chatIds: string[];
  routerName: string;
  templateUpId?: number | null;
  templateDownId?: number | null;
  interval?: string | null;
}

export function buildNetwatchScripts(params: BuildScriptParams) {
  const {
    name,
    host,
    tokenOrEnc,
    chatIds,
    routerName,
    templateUpId,
    templateDownId,
    interval,
  } = params;

  // Resolve bot token plaintext
  let token = tokenOrEnc;
  if (!token.includes(':')) {
    try {
      token = decrypt(tokenOrEnc);
    } catch {
      // fallback
    }
  }

  const db = getDb();
  const commentPrefix = getSetting<string>('defaults.comment_prefix', 'TG|');
  const defaultInterval = getSetting<string>('defaults.netwatch_interval', '00:00:10');
  const defaultTimeout = getSetting<string>('defaults.netwatch_timeout', '1000ms');

  // Load message templates
  const upTemplateRow = templateUpId
    ? (db.prepare('SELECT template FROM message_templates WHERE id = ?').get(templateUpId) as { template: string } | undefined)
    : (db.prepare("SELECT template FROM message_templates WHERE type = 'up' AND is_default = 1").get() as { template: string } | undefined);

  const downTemplateRow = templateDownId
    ? (db.prepare('SELECT template FROM message_templates WHERE id = ?').get(templateDownId) as { template: string } | undefined)
    : (db.prepare("SELECT template FROM message_templates WHERE type = 'down' AND is_default = 1").get() as { template: string } | undefined);

  const rawUpTemplate = upTemplateRow?.template || '✅ <b>{name}</b>\nHost: <code>{host}</code>\nRouter: {router}\nStatus: UP 🟢\nDate: {date}\nTime: {time}';
  const rawDownTemplate = downTemplateRow?.template || '🔴 <b>{name}</b>\nHost: <code>{host}</code>\nRouter: {router}\nStatus: DOWN 🔻\nDate: {date}\nTime: {time}';

  // Format message text for RouterOS /tool fetch URL
  // All emojis and unicode characters MUST be standard URL percent-encoded (e.g. ✅ -> %E2%9C%85)
  // because RouterOS /tool fetch URL parameter mangles raw unencoded multibyte UTF-8 characters to '?'
  function prepareMessage(template: string): string {
    const substituted = template
      .replace(/\{name\}/g, name)
      .replace(/\{host\}/g, host)
      .replace(/\{router\}/g, routerName || 'Router')
      .replace(/\{date\}/g, '___ROS_DATE___')
      .replace(/\{time\}/g, '___ROS_TIME___')
      .replace(/\r\n/g, '\n');

    return encodeURIComponent(substituted)
      .replace(/___ROS_DATE___/g, '$date')
      .replace(/___ROS_TIME___/g, '$time')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
  }

  function makeScript(encodedMsg: string): string {
    const lines = [
      ':local date [/system clock get date];',
      ':local time [/system clock get time];',
    ];

    const cleanChatIds = chatIds
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    for (const chatId of cleanChatIds) {
      lines.push(
        `/tool fetch url="https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&parse_mode=HTML&text=${encodedMsg}" keep-result=no;`
      );
    }

    return lines.join('\r\n');
  }

  const comment = `${commentPrefix}${name}`.slice(0, 99);
  const upScript = makeScript(prepareMessage(rawUpTemplate));
  const downScript = makeScript(prepareMessage(rawDownTemplate));

  return {
    upScript,
    downScript,
    comment,
    interval: interval?.trim() || defaultInterval,
    timeout: defaultTimeout,
  };
}

