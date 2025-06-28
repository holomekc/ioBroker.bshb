import axios from 'axios';
import * as qs from 'querystring';

const url = 'https://api-free.deepl.com/v2/translate';

const languages = {
  de: 'DE',
  ru: 'RU',
  pt: 'PT',
  nl: 'NL',
  fr: 'FR',
  it: 'IT',
  es: 'ES',
  pl: 'PL',
  uk: 'UK',
  'zh-cn': 'ZH',
};

/** Takes an english text and translates it into multiple languages */
export async function translateText(textEN) {
  const entries = await Promise.all(
    Object.entries(languages).map(async ([key, lang]) => {
      const response = await translateTo(textEN, lang);
      return [key, response.translations[0].text];
    })
  );

  return {
    en: textEN,
    ...Object.fromEntries(entries),
  };
}

async function translateTo(textEN, targetLang) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPL_API_KEY environment variable is not set');
  }

  const data = qs.stringify({
    text: [textEN],
    context: 'Release notes of a smart home application',
    source_lang: 'EN',
    target_lang: targetLang,
  });

  const response = await axios({
    method: 'post',
    url,
    data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
  });

  return response.data;
}
