# WenTian (Clean Pack for Vercel)
- 沒有 vercel.json（避免 regions 錯誤）
- 把整包上傳到 GitHub → Vercel Import → 設兩個環境變數 → Deploy

環境變數（Production）：
- GEMINI_API_KEY=你的金鑰（或 OPENAI_API_KEY=sk-... 任一組即可.）
- GEMINI_MODEL=gemini-1.5-flash（或 OPENAI_MODEL=gpt-4o）
- - GEMINI_MODEL=gemini-1.5-flash（或 OPENAI_MODEL=gpt-4o）
