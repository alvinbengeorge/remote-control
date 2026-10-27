/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Allow connections from any IP on local network
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, x-remote-token' },
        ],
      },
    ];
  },
};

export default nextConfig;
