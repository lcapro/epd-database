import type { EpdSetType } from '../types';

export function detectStandardSet(text: string): EpdSetType {
  const t = text.toLowerCase();
  const sbkSet1 = /sbk[\s_-]*set[\s_-]*1/.test(t);
  const sbkSet2 = /sbk[\s_-]*set[\s_-]*2/.test(t);
  const has1 = sbkSet1 || t.includes('en 15804+a1') || t.includes('en15804+a1');
  const has2 = sbkSet2 || t.includes('en 15804+a2') || t.includes('en15804+a2');
  if (has1 && has2) return 'SBK_BOTH';
  if (has1) return 'SBK_SET_1';
  if (has2) return 'SBK_SET_2';
  return 'UNKNOWN';
}
