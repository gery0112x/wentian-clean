// next.config.mjs
export default {
  async rewrites() {
    return [
      // ✅ 新增：總表健康與通用 chat 轉接到既有 API
      { source: '/_models/health', destination: '/api/models/health' },
      { source: '/_models/chat',   destination: '/api/chat' },

      // 既有供應商路由（保留）
      { source: '/_models/openai/:path*',   destination: '/api/openai/:path*' },
      { source: '/_models/deepseek/:path*', destination: '/api/deepseek/:path*' },
      { source: '/_models/grok/:path*',     destination: '/api/grok/:path*' },
      { source: '/_models/gemini/:path*',   destination: '/api/gemini/:path*' },

      // R5 轉接（保留）
      { source: '/_r5/:path*', destination: '/api/r5/:path*' },
    ];
  },

  async redirects() {
    return [{ source: '/', destination: '/home', permanent: false }];
  },
};
