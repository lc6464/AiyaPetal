function interpolate(template, values = {}) {
  if (typeof template !== 'string') {
    return '';
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined || value === null ? match : String(value);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${url}`);
  }

  return response.json();
}

const LOCALE_LANG = Object.freeze({
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-HK',
  en: 'en',
});

const LOCALE_DISPLAY_NAMES = Object.freeze({
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  en: 'English',
});

function resolveBrowserLocale(supportedLocales) {
  const browserLocale = (navigator.language || navigator.languages?.[0] || '').toLowerCase();
  if (!browserLocale) {
    return supportedLocales[0] ?? 'zh-Hans';
  }

  if (browserLocale.startsWith('zh')) {
    if (browserLocale.includes('hant') || browserLocale.includes('tw') || browserLocale.includes('hk') || browserLocale.includes('mo')) {
      return supportedLocales.includes('zh-Hant') ? 'zh-Hant' : supportedLocales[0] ?? 'zh-Hans';
    }

    return supportedLocales.includes('zh-Hans') ? 'zh-Hans' : supportedLocales[0] ?? 'zh-Hans';
  }

  if (browserLocale.startsWith('en') && supportedLocales.includes('en')) {
    return 'en';
  }

  return supportedLocales[0] ?? 'zh-Hans';
}

export class I18nService extends EventTarget {
  #storageKey;
  #translationsUrl;
  #messages = null;
  #locale = 'system';
  #resolvedLocale = 'zh-Hans';

  constructor({ translationsUrl, storageKey = 'aiya-petal-locale' } = {}) {
    super();
    this.#translationsUrl = translationsUrl;
    this.#storageKey = storageKey;
  }

  async initialize() {
    this.#messages = await fetchJson(this.#translationsUrl);

    const preferredLocale = globalThis.localStorage?.getItem(this.#storageKey)
      || 'system'
      || this.#messages.defaultLocale
      || 'zh-Hans';

    this.setLocale(preferredLocale, { silent: true });
    return this;
  }

  getLocale() {
    return this.#locale;
  }

  getResolvedLocale() {
    return this.#resolvedLocale;
  }

  getSupportedLocales() {
    return this.#messages?.supportedLocales ?? ['zh-Hans', 'zh-Hant', 'en'];
  }

  getLocaleDisplayName(locale) {
    return LOCALE_DISPLAY_NAMES[locale] ?? locale;
  }

  getSystemLocale() {
    return resolveBrowserLocale(this.getSupportedLocales());
  }

  setLocale(locale, { silent = false } = {}) {
    const supportedLocales = this.getSupportedLocales();
    const nextLocale = locale === 'system' || supportedLocales.includes(locale)
      ? locale
      : 'system';

    const resolvedLocale = nextLocale === 'system'
      ? this.getSystemLocale()
      : nextLocale;

    this.#locale = nextLocale;
    this.#resolvedLocale = resolvedLocale;
    globalThis.localStorage?.setItem(this.#storageKey, nextLocale);
    document.documentElement.lang = LOCALE_LANG[resolvedLocale] ?? resolvedLocale;

    if (!silent) {
      this.dispatchEvent(new CustomEvent('change', {
        detail: {
          locale: nextLocale,
          resolvedLocale,
        },
      }));
    }
  }

  t(key, values = {}, fallback = '') {
    const record = this.#messages?.ui?.[key];
    const message = record?.[this.#resolvedLocale]
      ?? record?.[this.#messages?.defaultLocale ?? 'zh-Hans']
      ?? fallback
      ?? key;

    return interpolate(message, values);
  }

  label(id, values = {}, fallback = '') {
    const record = this.#messages?.labels?.[id];
    const message = record?.[this.#resolvedLocale]
      ?? record?.[this.#messages?.defaultLocale ?? 'zh-Hans']
      ?? fallback
      ?? id;

    return interpolate(message, values);
  }

  applyTo(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      if (!(element instanceof HTMLElement) && !(element instanceof HTMLTitleElement)) {
        return;
      }

      const key = element.dataset.i18n;
      if (!key) {
        return;
      }

      const fallback = element.dataset.i18nFallback ?? element.textContent ?? '';
      const value = this.t(key, {}, fallback.trim());
      const attr = element.dataset.i18nAttr;

      if (attr) {
        element.setAttribute(attr, value);
        return;
      }

      element.textContent = value;
    });
  }
}

export function syncLocaleSelect(select, i18n) {
  const options = ['system', ...i18n.getSupportedLocales()];
  const nextChildren = options.map((locale) => {
    const option = document.createElement('option');
    option.value = locale;
    if (locale === 'system') {
      option.textContent = i18n.t('locale.followSystem', {
        language: i18n.getLocaleDisplayName(i18n.getSystemLocale()),
      });
      return option;
    }

    option.textContent = i18n.getLocaleDisplayName(locale);
    return option;
  });

  select.replaceChildren(...nextChildren);
  select.value = i18n.getLocale();
}
