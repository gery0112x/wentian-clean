'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type UISettings = {
  model: 'deepseek-12b'|'deepseek-30b'|'gpt-4o'|'gemini'|'grok'
  style: 'gu-tech'|'plain'|'掌門令'|'工務札記'|'溫柔說'
  theme: 'dark'|'light'
  tone: 'neutral'|'brief'|'playful'|'strict'
}

const ACCENT = '#00A3C4'
const LOCAL_KEY = 'wj_ui'
const DEFAULTS: UISettings = {
  model: 'deepseek-30b',
  style: 'gu-tech',
  theme: 'dark',
  tone: 'neutral',
}

export default function Entry() {
  const router = useRouter()

  // ===== 狀態（含本機記憶）=====
  const [ui, setUI] = useState<UISettings>(DEFAULTS)
  const [clock, setClock] = useState('--:--')

  // 一鍵升級用
  const [upgrading, setUpgrading] = useState(false)
  const [progress, setProgress] = useState(0)

  // 啟動：讀本機記憶 + 時鐘
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')
      setUI({ ...DEFAULTS, ...saved })
    } catch {}
    const id = setInterval(() => {
      const d = new Date()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      setClock(`${hh}:${mm}`)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // 寫本機
  function writeLocal(next: Partial<UISettings>) {
    const merged = { ...ui, ...next }
    setUI(merged)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(merged))
  }

  // 一鍵升級（先做可見版本：進度條 → 完成導到 /fuceti）
  function startUpgrade() {
    setUpgrading(true)
    setProgress(5)
    let p = 5
    const t = setInterval(() => {
      p = Math.min(p + 10, 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(t)
        setTimeout(() => {
          setUpgrading(false)
          router.push('/fuceti') // 升級完成進入富策體頁
        }, 400)
      }
    }, 300)
  }

  const themeClass =
    ui.theme === 'dark'
      ? 'bg-zinc-950 text-zinc-200'
      : 'bg-zinc-50 text-zinc-900'

  const badge = useMemo(() => 'Local ✓', [])

  return (
    <div className={`min-h-screen ${themeClass}`} style={{ ['--accent' as any]: ACCENT }}>
      {/* 頂欄 */}
      <div className="w-full px-4 py-2 flex items-center justify-between border-b border-zinc-800/60 sticky top-0 backdrop-blur">
        <div className="font-semibold tracking-wide">無極•元始 00-01</div>
        <div className="text-sm opacity-80">{clock} · {badge}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={startUpgrade}
            className="px-3 py-1 rounded-xl border border-zinc-700 hover:border-[var(--accent)]"
          >
            一鍵升級
          </button>
        </div>
      </div>

      {/* 版面：左側快捷／右側對話 */}
      <div className="grid grid-cols-12 gap-4 p-4">
        {/* 側欄 */}
        <aside className="col-span-12 md:col-span-3 space-y-3 order-2 md:order-1">
          <Section title="快捷切換">
            <Row label="模型">
              <Select
                value={ui.model}
                onChange={(v) => writeLocal({ model: v as UISettings['model'] })}
                options={[
                  ['deepseek-12b','12B'],
                  ['deepseek-30b','30B'],
                  ['gpt-4o','4o'],
                  ['gemini','Gemini'],
                  ['grok','Grok'],
                ]}
              />
            </Row>
            <Row label="語風">
              <Select
                value={ui.tone}
                onChange={(v) => writeLocal({ tone: v as UISettings['tone'] })}
                options={[
                  ['neutral','一般'],
                  ['brief','精簡'],
                  ['playful','親切'],
                  ['strict','嚴謹'],
                ]}
              />
            </Row>
            <Row label="風格">
              <Select
                value={ui.style}
                onChange={(v) => writeLocal({ style: v as UISettings['style'] })}
                options={[
                  ['gu-tech','gu-tech'],
                  ['plain','plain'],
                  ['掌門令','掌門令'],
                  ['工務札記','工務札記'],
                  ['溫柔說','溫柔說'],
                ]}
              />
            </Row>
            <Row label="主題">
              <Select
                value={ui.theme}
                onChange={(v) => writeLocal({ theme: v as UISettings['theme'] })}
                options={[
                  ['dark','深色'],
                  ['light','淺色'],
                ]}
              />
            </Row>
          </Section>

          <Section title="功能">
            <ul className="text-sm leading-7 opacity-90">
              <li><a href="/project">專案管理</a></li>
              <li><a href="/fuceti">富策體</a></li>
              <li><a href="/monitor">監察</a></li>
              <li><a href="/publish">出版資訊</a></li>
              <li><a href="/settings">平台設定</a></li>
            </ul>
          </Section>
        </aside>

        {/* 主區：對話卡 */}
        <main className="col-span-12 md:col-span-9 space-y-4 order-1 md:order-2">
          <div className="rounded-2xl border border-zinc-800/60 p-4 shadow-xl">
            <div className="text-sm mb-2 opacity-80">
              模型：{ui.model} ｜ 語風：{ui.tone} ｜ 風格：{ui.style}
            </div>
            <textarea
              className="w-full h-32 rounded-xl bg-transparent border border-zinc-800/60 p-3 outline-none focus:border-[var(--accent)]"
              placeholder="在這裡貼你的規劃（例如：富策體規劃）…"
            />
            <div className="mt-3 flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-xl border border-zinc-700 hover:border-[var(--accent)]">
                清除
              </button>
              <button className="px-4 py-2 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]">
                送出
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* 升級進度條（浮層） */}
      {upgrading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[360px]">
            <div className="font-semibold mb-3">升級中…請稍候</div>
            <div className="w-full h-3 rounded bg-zinc-800 overflow-hidden">
              <div className="h-3 bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-sm opacity-80 mt-2">{progress}%</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- 小元件 ---------- */
function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 p-3">
      <div className="text-xs uppercase tracking-widest mb-2 opacity-70">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="w-14 text-sm opacity-80">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border border-zinc-800/60 rounded-xl px-3 py-2 outline-none focus:border-[var(--accent)]"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v} className="bg-zinc-900">
          {l}
        </option>
      ))}
    </select>
  )
}
