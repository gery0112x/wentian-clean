export const runtime = 'nodejs';

export async function GET() {
  const payload = {
    layer: 2,
    updatedAt: new Date().toISOString(),
    buttons: [
      { key:"deploy", label:"部署到正式", enabled:false, note:"已收納於第2層版本資訊；待 ChatOps 接通後啟用" },
      { key:"preview", label:"發預覽", enabled:false, note:"同上" },
      { key:"rollback", label:"回滾上一版", enabled:false, note:"同上" },
      { key:"pr", label:"開PR", enabled:false, note:"同上" },
      { key:"workflow", label:"跑流程", enabled:false, note:"同上" },
      { key:"edge", label:"觸發Edge函數", enabled:false, note:"同上" }
    ]
  };
  return Response.json(payload);
}
