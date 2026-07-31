/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const securityHeaders = [
  { key: "Content-Security-Policy", value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const commonConfig = {
  outputFileTracingRoot: process.cwd(),
  ...(!isGitHubPages && {
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders }];
    }
  })
};

const nextConfig = isGitHubPages ? {
  ...commonConfig,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: "/instagram-post-analytics-ai",
  assetPrefix: "/instagram-post-analytics-ai/"
} : commonConfig;

export default nextConfig;
