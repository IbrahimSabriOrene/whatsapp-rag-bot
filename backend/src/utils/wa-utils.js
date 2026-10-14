async function resolveAuthorName(msg, client, chat) {
  const pickName = (c) => c?.pushname ||
    c?.name ||
    c?.shortName ||
    c?.verifiedName ||
    c?.formattedName ||
    c?.displayName ||
    c?.profileName ||
    c?._data?.notifyName ||
    c?._data?.pushname ||
    c?._data?.name ||
    c?.number;

  const fallback = msg?._data?.notifyName ||
    msg?._data?.senderName ||
    msg?._data?.pushname ||
    msg?._data?.name ||
    msg?._data?.displayName ||
    msg?._data?.sender?.notifyName ||
    msg?._data?.sender?.pushname ||
    msg?._data?.sender?.name ||
    msg?._data?.sender?.shortName ||
    msg?._data?.sender?.verifiedName ||
    msg?._data?.sender?.formattedName ||
    msg?._data?.authorName ||
    msg?.author ||
    msg?.from ||
    '';

  try {
    if (chat && msg && msg.author && Array.isArray(chat.participants)) {
      const p = chat.participants.find((x) => {
        const pid = x?.id?._serialized || x?.id || '';
        return pid === msg.author;
      });
      const name = pickName(p?.contact) || p?.name || p?.pushname || p?.shortName || p?.verifiedName || p?.formattedName;
      if (name) return name;
    }
  } catch (_) {}

  try {
    if (msg && msg.author && client && typeof client.getContactById === 'function') {
      const c = await client.getContactById(msg.author);
      const name = pickName(c);
      if (name) return name;
    }
  } catch (_) {}

  try {
    if (msg && typeof msg.getContact === 'function') {
      const c = await msg.getContact();
      const name = pickName(c);
      if (name) return name;
    }
  } catch (_) {}

  return String(fallback || '');
}

async function resolveMentionNames(msg, client) {
  try {
    if (!msg) return [];
    const ids = Array.isArray(msg.mentionedIds) ? msg.mentionedIds : [];
    if (!ids.length) return [];

    if (typeof msg.getMentions === 'function') {
      const mentionContacts = await msg.getMentions();
      const names = Array.isArray(mentionContacts)
        ? mentionContacts.map(c => c?.pushname || c?.name || c?.shortName || c?.number).filter(Boolean)
        : [];
      if (names.length) return names;
    }

    if (client && typeof client.getContactById === 'function') {
      const out = [];
      for (const id of ids) {
        try {
          const c = await client.getContactById(id);
          const name = c?.pushname || c?.name || c?.shortName || c?.number;
          if (name) out.push(name);
        } catch (_) {}
      }
      return out;
    }
  } catch (_) {}
  return [];
}

function getConversationId(msg) {
  if (!msg) return '';
  if (msg.fromMe && msg.to) return msg.to;
  return msg.from || '';
}

module.exports = {
  resolveAuthorName,
  resolveMentionNames,
  getConversationId
};
