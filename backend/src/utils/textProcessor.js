class TextProcessor {
  static cleanText(text) {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Remove emojis
      .substring(0, 5000); // Limit length
  }

  static extractQuestion(text, triggerWord) {
    const regex = new RegExp(`^${triggerWord}\\s+(.+)$`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  static isQuestion(text, triggerWord) {
    return text.toLowerCase().startsWith(triggerWord.toLowerCase());
  }

  static isNaturalQuestion(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();

    // Immediate question mark
    if (t.includes('?')) return true;

    // Turkish question particles at the end of sentence
    const trParticles = [' mi', ' mı', ' mu', ' mü'];
    if (trParticles.some(p => t.endsWith(p))) return true;

    // Interrogatives appearing anywhere in the sentence (TR + EN)
    const interrogatives = [
      ' ne ', ' neden ', ' nasil ', ' nasıl ', ' hangi ', ' kim ', ' nerede ', ' nerde ', ' neydi ',
      ' what ', ' why ', ' how ', ' which ', ' who ', ' remind '
    ];
    if (interrogatives.some(s => t.includes(s))) return true;

    const temporalPhrases = [
      'gecen hafta', 'geçen hafta', 'bu hafta', 'gecen gun', 'geçen gün', 'bugun', 'bugün', 'dun', 'dün', 'son hafta',
      'last week', 'this week', 'yesterday', 'today'
    ];
    const convoVerbs = [
      'konustuk', 'konuştuk', 'konusuyoruz', 'konuşuyoruz', 'konu', 'konuş', 'sohbet', 'özet', 'ozet', 'summary', 'summarize', 'discuss', 'talk'
    ];
    const hasTemporal = temporalPhrases.some(s => t.includes(s));
    const hasConvoVerb = convoVerbs.some(v => t.includes(v));
    if (hasTemporal && hasConvoVerb) return true;

    return false;
  }

  static generateMessageId(msg) {
    const mid = (msg.id && (msg.id._serialized || msg.id.id)) || String(msg.id || '');
    return `${msg.from}_${msg.timestamp}_${mid}`;
  }
}

module.exports = TextProcessor;// Text cleaning utilities

