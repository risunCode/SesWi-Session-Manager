const PUBLIC_SUFFIXES: Record<string, true> = {
  'co.uk': true, 'ac.uk': true, 'gov.uk': true, 'org.uk': true, 'me.uk': true, 'net.uk': true,
  'com.au': true, 'net.au': true, 'org.au': true, 'edu.au': true, 'gov.au': true,
  'co.id': true, 'ac.id': true, 'go.id': true, 'or.id': true, 'web.id': true,
  'co.jp': true, 'ac.jp': true, 'go.jp': true, 'or.jp': true, 'ne.jp': true,
  'com.br': true, 'net.br': true, 'org.br': true, 'gov.br': true, 'edu.br': true,
  'co.in': true, 'ac.in': true, 'gov.in': true, 'org.in': true, 'net.in': true,
  'co.nz': true, 'co.za': true, 'co.kr': true, 'com.mx': true, 'com.cn': true, 'com.tw': true, 'com.hk': true,
  'com.sg': true, 'com.my': true, 'com.ph': true, 'com.vn': true, 'com.ar': true, 'com.co': true,
};

export const Domain = {
  getBase(input: string): string {
    if (!input) throw new Error('Invalid URL');
    let hostname = input;
    try {
      if (input.includes('://')) hostname = new URL(input).hostname;
    } catch {
      hostname = input;
    }
    hostname = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
    if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return hostname;
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length <= 2) return hostname;
    const tail2 = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (PUBLIC_SUFFIXES[tail2] && parts.length >= 3) return `${parts[parts.length - 3]}.${tail2}`;
    return tail2;
  },
  isMatch(sessionDomain: string, currentDomain: string): boolean {
    if (!sessionDomain || !currentDomain) return false;
    const sd = sessionDomain.replace(/^\./, '').toLowerCase();
    const cd = currentDomain.replace(/^\./, '').toLowerCase();
    return cd === sd || cd.endsWith(`.${sd}`);
  },
  isSensitive(domain: string): boolean {
    if (!domain) return false;
    const value = domain.toLowerCase();
    let base = value;
    try {
      base = this.getBase(value);
    } catch {
      base = value;
    }
    const known = new Set([
      'google.com', 'gmail.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com',
      'youtube.com', 'youtube-nocookie.com', 'youtu.be', 'ytimg.com',
      'microsoft.com', 'outlook.com', 'office.com', 'live.com', 'microsoftonline.com', 'sharepoint.com', 'azure.com', 'msn.com',
    ]);
    return known.has(base) || /google|gmail|youtube|microsoft|office|outlook|live|msn|sharepoint|azure/i.test(value);
  },
  isSafeUrl(url: string): boolean {
    try {
      return ['http:', 'https:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  },
} as const;
