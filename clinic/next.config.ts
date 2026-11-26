import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['mysql2', 'ioredis', 'nodemailer'],
};

export default nextConfig;
