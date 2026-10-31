import { decrypt } from './crypto';

const TELEGRAM_BASE_URL = 'https://api.telegram.org/bot';

function resolveToken(tokenOrEnc: string): string {
  // If it contains a colon and looks like a bot token (e.g. 123456:ABC-...), use it directly
  if (tokenOrEnc.includes(':')) {
    return tokenOrEnc.trim();
  }
  // Otherwise decrypt from base64
  try {
    return decrypt(tokenOrEnc).trim();
  } catch {
    return tokenOrEnc.trim();
  }
}

/**
 * Perform a Telegram Bot API HTTP request
 */
async function callTelegramApi(tokenOrEnc: string, method: string, payload: Record<string, unknown> = {}) {
  const token = resolveToken(tokenOrEnc);
  if (!token) {
    throw new Error('Telegram bot token is missing or empty.');
  }

  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_BASE_URL}${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`Failed to reach Telegram servers: ${(err as Error).message}`);
  }

  let data: { ok: boolean; description?: string; result?: unknown };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Invalid JSON received from Telegram API (HTTP ${res.status}).`);
  }

  if (!data.ok) {
    const desc = data.description || 'Unknown Telegram API error.';
    if (desc.includes('Unauthorized') || desc.includes('Not Found')) {
      throw new Error('Invalid Telegram bot token. Please check the token provided by @BotFather.');
    }
    if (desc.includes('chat not found')) {
      throw new Error('Chat ID not found. Ensure the user/group has started a conversation with the bot.');
    }
    if (desc.includes('bot was blocked')) {
      throw new Error('The bot was blocked by the user or removed from the group.');
    }
    throw new Error(desc);
  }

  return data.result;
}

export async function verifyBotToken(tokenOrEnc: string) {
  const result = (await callTelegramApi(tokenOrEnc, 'getMe')) as {
    id: number;
    username?: string;
    first_name?: string;
  };

  return {
    id: result.id,
    username: result.username || '',
    firstName: result.first_name || '',
  };
}

export async function sendTelegramTestMessage(tokenOrEnc: string, chatId: string) {
  return callTelegramApi(tokenOrEnc, 'sendMessage', {
    chat_id: chatId.trim(),
    text: `🚀 <b>Netwatch Alert Manager</b>\n\n✅ <b>Test Successful!</b>\nYour Telegram bot and chat are correctly connected.\n\n<i>Timestamp: ${new Date().toISOString()}</i>`,
    parse_mode: 'HTML',
  });
}

