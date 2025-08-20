// /lib/identity.ts
export const PLATFORM = '無極';
export const REALM = '元始境 00-00';
export const OPERATOR = '柯老';

/**
 * 後台可用的小型標頭，用於 API 回覆辨識
 */
export function banner() {
  return `${PLATFORM}.${REALM} — 操作者：${OPERATOR}`;
}
