// /lib/intent-gateway.ts

export type Intent =
  | 'DRAFT'      // 新增/調整 → 起草提案
  | 'REVISE'     // 再議/比較 → 修訂提案
  | 'EXECUTE'    // 執行 120s 快門驗證
  | 'STATUS'     // 查流程狀態
  | 'ROLLBACK'   // 回滾上一版
  | 'NONE';

const KW = {
  draft:   ['新增','建立','加上','調整','修改','替換','優化','提案','方案','規劃','草稿'],
  revise:  ['再議','重寫','比較','a/b','換模型','對照'],
  exec:    ['執行','上線','驗證','快門','接回','跑一次'],
  status:  ['進度','狀態','跑到哪','現在怎樣','好了沒'],
  rollback:['回滾','退回','還原','復原']
};

const hit = (s: string, arr: string[]) => {
  const low = s.toLowerCase();
  return arr.some(k => low.includes(k.toLowerCase()));
};

export function detectIntent(text: string): Intent {
  if (hit(text, KW.rollback)) return 'ROLLBACK';
  if (hit(text, KW.status))   return 'STATUS';
  if (hit(text, KW.exec))     return 'EXECUTE';
  if (hit(text, KW.revise))   return 'REVISE';
  if (hit(text, KW.draft))    return 'DRAFT';
  return 'NONE';
}

function topicFrom(text: string) {
  const t = text.replace(/(新增|建立|加上|調整|修改|替換|優化|提案|方案|規劃|草稿|再議|重寫|比較|a\/b|換模型|對照|執行|上線|驗證|快門|接回|跑一次|進度|狀態|跑到哪|現在怎樣|好了沒|回滾|退回|還原|復原)/g, '').trim();
  return t.slice(0, 24) || '未命名主題';
}

/**
 * 由後台（Server）直連現有 API 的總管
 * @param baseURL 例如 https://wentian-clean.vercel.app
 * @param text    使用者自然語句
 */
export async function runOnServer(baseURL: string, text: string) {
  const intent = detectIntent(text);
  const notes  = text;

  try {
    switch (intent) {
      case 'ROLLBACK': {
        const r = await fetch(`${baseURL}/api/upgrade/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'rollback', reason: notes }),
          cache: 'no-store',
        }).then(r=>r.json());
        return { handled: true, intent, result: r };
      }
      case 'STATUS': {
        const r = await fetch(`${baseURL}/api/upgrade/status`, {
          cache: 'no-store',
        }).then(r=>r.json());
        return { handled: true, intent, result: r };
      }
      case 'EXECUTE': {
        // 若前端/後台尚無實際提案 id，就走 TEMP（你的後端已有支援）
        const r = await fetch(`${baseURL}/api/upgrade/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'execute', proposalId: 'TEMP' }),
          cache: 'no-store',
        }).then(r=>r.json());
        return { handled: true, intent, result: r };
      }
      case 'REVISE':
      case 'DRAFT': {
        const op    = intent === 'REVISE' ? 'revise' : 'draft';
        const topic = topicFrom(text);
        const r = await fetch(`${baseURL}/api/proposal`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op, topic, notes }),
          cache: 'no-store',
        }).then(r=>r.json());
        return { handled: true, intent, result: r };
      }
      default:
        return { handled: false, intent, result: null };
    }
  } catch (error) {
    return { handled: true, intent, error: String(error) };
  }
}
