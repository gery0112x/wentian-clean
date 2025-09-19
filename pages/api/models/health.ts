import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    service: 'models',
    time: new Date().toISOString(),
    hint_zh: '此端點正常；/models/chat 亦可用'
  })
}
