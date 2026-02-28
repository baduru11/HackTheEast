import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.bbci.co.uk" },
      { protocol: "https", hostname: "*.cnbc.com" },
      { protocol: "https", hostname: "*.coindesk.com" },
      { protocol: "https", hostname: "*.cointelegraph.com" },
      { protocol: "https", hostname: "*.investing.com" },
      { protocol: "https", hostname: "i-invdn-com.investing.com" },
      { protocol: "https", hostname: "*.reuters.com" },
      { protocol: "https", hostname: "*.theguardian.com" },
      { protocol: "https", hostname: "*.fool.com" },
      { protocol: "https", hostname: "*.benzinga.com" },
      { protocol: "https", hostname: "*.forexlive.com" },
      { protocol: "https", hostname: "*.aljazeera.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
