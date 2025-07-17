/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['pdf-parse'], // previne includerea fișierelor de test în build
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('supports-color'); // necesar pentru a preveni alte erori de pachet
    }
    return config;
  },
};

module.exports = nextConfig;
