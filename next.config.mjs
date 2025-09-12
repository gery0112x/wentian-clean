/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/_models/openai/:path*',  destination: '/api/openai/:path*'  },
      { source: '/_models/deepseek/:path*',destination: '/api/deepseek/:path*'},
      { source: '/_models/grok/:path*',    destination: '/api/grok/:path*'    },
      { source: '/_models/gemini/:path*',  destination: '/api/gemini/:path*'  },
      { source: '/_r5/:path*',             destination: '/api/r5/:path*'      },
    ];
  },
  async redirects() {
    return [{ source: '/', destination: '/home', permanent: false }];
  },
};
export default nextConfig;
