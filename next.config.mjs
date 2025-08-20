/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true }
  // 絕對不要加 output: 'export'
};
export default nextConfig;
