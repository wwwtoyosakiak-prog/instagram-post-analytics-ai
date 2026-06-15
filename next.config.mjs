/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const commonConfig = {
  outputFileTracingRoot: process.cwd()
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
