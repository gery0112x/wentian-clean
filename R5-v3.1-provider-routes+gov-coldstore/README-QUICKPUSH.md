# 一鍵覆蓋：四大家族路由 + R5-v3.1 產物

## 步驟 A：解壓覆蓋
把此壓縮包解壓到專案根目錄（會新增/覆蓋）：
- app/api/{openai,deepseek,grok,gemini}/chat/route.ts
- app/_models/_shared/model-allow.ts
- supabase/migrations/20250915_gov_coldstore.sql
- .github/workflows/daily-report.yml
- scripts/daily-report.mjs
- coldstore/2025/09/15/*

## 步驟 B：設定環境變數（Vercel 專案）
- `AI_GATEWAY_URL`（必填）：指向 Gateway，例如 `https://<gateway-domain>`
- （已有）`NEXT_PUBLIC_R5_BASE="/_r5"`、`NEXT_PUBLIC_MODELS_BASE="/_models"`

## 步驟 C：最少 3 行指令（忘了怎麼推用這組）
```bash
git checkout -b R5-v3.1-provider-routes
git add . && git commit -m "chore: override 4 providers routes + gov/coldstore bundle"
git push -u origin R5-v3.1-provider-routes
```
然後：
- **用 GitHub 介面** → 開 PR（base=main）→ Merge
或
- **用 GH CLI**（可選）
```bash
gh pr create --title "R5-v3.1: provider routes override + gov/coldstore" --body-file README-QUICKPUSH.md --base main
```

## 排雷
- 500 MISSING_GATEWAY_URL：沒設 `AI_GATEWAY_URL`（請用完整 https 網域）。
- 422 MODEL_NOT_ALLOWED：模型不在白名單；OpenAI 用 `gpt-4o`/`gpt-4o-mini`，DeepSeek 用 `deepseek-chat`。
- 404 路由：Next 需重新部署或重新啟動 Dev。
- Actions 無法產生日報：請在 GitHub Secrets 填 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。

## 驗收
- GET `/_models/openai/chat?q=ping` → 200（經 rewrites → /api/openai/chat）
- POST `/_models/openai/chat` model=`gpt-4o` → 200（串流/JSON）
- Network 僅見 `/_models/*`、`/_r5/*`；無直連供應商域名