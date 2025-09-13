import { ImageResponse } from 'next/og'
export const runtime = 'edge'
export const contentType = 'image/png'
export async function GET() {
  return new ImageResponse(
    <div style={{
      width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#111827',color:'#fff',fontSize:200,fontWeight:800
    }}>無</div>,
    { width:512, height:512 }
  )
}
