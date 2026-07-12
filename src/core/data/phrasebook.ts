// Offline travel phrasebook (the RN stand-in for the iOS Translator until a
// translation API/on-device model is wired). Phrases are index-aligned to
// PHRASE_LABELS. `p` is a romanized pronunciation for non-Latin scripts.

export const PHRASE_LABELS = [
  'Hello',
  'Thank you',
  'Please',
  'Yes',
  'No',
  'Excuse me',
  'Help!',
  'How much?',
  'Where is the bathroom?',
  'Do you speak English?',
];

export interface Phrase {
  t: string;
  p?: string;
}
export interface Language {
  code: string; // BCP-47-ish, used for TTS
  name: string;
  flag: string;
  lines: Phrase[];
}

export const LANGUAGES: Language[] = [
  {
    code: 'es', name: 'Spanish', flag: '🇪🇸',
    lines: [{ t: 'Hola' }, { t: 'Gracias' }, { t: 'Por favor' }, { t: 'Sí' }, { t: 'No' }, { t: 'Perdón' }, { t: '¡Ayuda!' }, { t: '¿Cuánto cuesta?' }, { t: '¿Dónde está el baño?' }, { t: '¿Habla inglés?' }],
  },
  {
    code: 'fr', name: 'French', flag: '🇫🇷',
    lines: [{ t: 'Bonjour' }, { t: 'Merci' }, { t: "S'il vous plaît" }, { t: 'Oui' }, { t: 'Non' }, { t: 'Excusez-moi' }, { t: 'Au secours!' }, { t: 'Combien ça coûte?' }, { t: 'Où sont les toilettes?' }, { t: 'Parlez-vous anglais?' }],
  },
  {
    code: 'de', name: 'German', flag: '🇩🇪',
    lines: [{ t: 'Hallo' }, { t: 'Danke' }, { t: 'Bitte' }, { t: 'Ja' }, { t: 'Nein' }, { t: 'Entschuldigung' }, { t: 'Hilfe!' }, { t: 'Wie viel kostet das?' }, { t: 'Wo ist die Toilette?' }, { t: 'Sprechen Sie Englisch?' }],
  },
  {
    code: 'it', name: 'Italian', flag: '🇮🇹',
    lines: [{ t: 'Ciao' }, { t: 'Grazie' }, { t: 'Per favore' }, { t: 'Sì' }, { t: 'No' }, { t: 'Mi scusi' }, { t: 'Aiuto!' }, { t: 'Quanto costa?' }, { t: "Dov'è il bagno?" }, { t: 'Parla inglese?' }],
  },
  {
    code: 'pt', name: 'Portuguese', flag: '🇧🇷',
    lines: [{ t: 'Olá' }, { t: 'Obrigado' }, { t: 'Por favor' }, { t: 'Sim' }, { t: 'Não' }, { t: 'Com licença' }, { t: 'Socorro!' }, { t: 'Quanto custa?' }, { t: 'Onde fica o banheiro?' }, { t: 'Você fala inglês?' }],
  },
  {
    code: 'nl', name: 'Dutch', flag: '🇳🇱',
    lines: [{ t: 'Hallo' }, { t: 'Dank je' }, { t: 'Alsjeblieft' }, { t: 'Ja' }, { t: 'Nee' }, { t: 'Pardon' }, { t: 'Help!' }, { t: 'Hoeveel kost het?' }, { t: 'Waar is het toilet?' }, { t: 'Spreekt u Engels?' }],
  },
  {
    code: 'ja', name: 'Japanese', flag: '🇯🇵',
    lines: [{ t: 'こんにちは', p: 'Konnichiwa' }, { t: 'ありがとう', p: 'Arigatō' }, { t: 'お願いします', p: 'Onegaishimasu' }, { t: 'はい', p: 'Hai' }, { t: 'いいえ', p: 'Iie' }, { t: 'すみません', p: 'Sumimasen' }, { t: '助けて！', p: 'Tasukete!' }, { t: 'いくらですか？', p: 'Ikura desu ka?' }, { t: 'トイレはどこですか？', p: 'Toire wa doko desu ka?' }, { t: '英語を話せますか？', p: 'Eigo o hanasemasu ka?' }],
  },
  {
    code: 'zh', name: 'Mandarin', flag: '🇨🇳',
    lines: [{ t: '你好', p: 'Nǐ hǎo' }, { t: '谢谢', p: 'Xièxie' }, { t: '请', p: 'Qǐng' }, { t: '是', p: 'Shì' }, { t: '不是', p: 'Bù shì' }, { t: '对不起', p: 'Duìbùqǐ' }, { t: '救命！', p: 'Jiùmìng!' }, { t: '多少钱？', p: 'Duōshǎo qián?' }, { t: '洗手间在哪里？', p: 'Xǐshǒujiān zài nǎlǐ?' }, { t: '你会说英语吗？', p: 'Nǐ huì shuō yīngyǔ ma?' }],
  },
  {
    code: 'th', name: 'Thai', flag: '🇹🇭',
    lines: [{ t: 'สวัสดี', p: 'Sawasdee' }, { t: 'ขอบคุณ', p: 'Khop khun' }, { t: 'กรุณา', p: 'Karuna' }, { t: 'ใช่', p: 'Chai' }, { t: 'ไม่', p: 'Mai' }, { t: 'ขอโทษ', p: 'Kho thot' }, { t: 'ช่วยด้วย!', p: 'Chuay duay!' }, { t: 'เท่าไหร่?', p: 'Thao rai?' }, { t: 'ห้องน้ำอยู่ที่ไหน?', p: 'Hong nam yu thi nai?' }, { t: 'พูดภาษาอังกฤษได้ไหม?', p: 'Phut phasa angkrit dai mai?' }],
  },
  {
    code: 'ar', name: 'Arabic', flag: '🇦🇪',
    lines: [{ t: 'مرحبا', p: 'Marhaba' }, { t: 'شكرا', p: 'Shukran' }, { t: 'من فضلك', p: 'Min fadlik' }, { t: 'نعم', p: "Na'am" }, { t: 'لا', p: 'La' }, { t: 'عذرا', p: 'Udhran' }, { t: 'النجدة!', p: 'An-najda!' }, { t: 'بكم؟', p: 'Bikam?' }, { t: 'أين الحمام؟', p: 'Ayna al-hammam?' }, { t: 'هل تتكلم الإنجليزية؟', p: 'Hal tatakallam al-injliziyya?' }],
  },
  {
    code: 'hi', name: 'Hindi', flag: '🇮🇳',
    lines: [{ t: 'नमस्ते', p: 'Namaste' }, { t: 'धन्यवाद', p: 'Dhanyavaad' }, { t: 'कृपया', p: 'Kripya' }, { t: 'हाँ', p: 'Haan' }, { t: 'नहीं', p: 'Nahin' }, { t: 'माफ़ कीजिए', p: 'Maaf kijiye' }, { t: 'मदद!', p: 'Madad!' }, { t: 'कितने का है?', p: 'Kitne ka hai?' }, { t: 'बाथरूम कहाँ है?', p: 'Bathroom kahan hai?' }, { t: 'क्या आप अंग्रेज़ी बोलते हैं?', p: 'Kya aap angrezi bolte hain?' }],
  },
];

const COUNTRY_LANG: Record<string, string> = {
  ES: 'es', MX: 'es', FR: 'fr', DE: 'de', IT: 'it', BR: 'pt', NL: 'nl',
  JP: 'ja', CN: 'zh', TH: 'th', AE: 'ar', IN: 'hi',
};

export function languageForCountry(code?: string): Language | undefined {
  if (!code) return undefined;
  const lang = COUNTRY_LANG[code];
  return LANGUAGES.find((l) => l.code === lang);
}
