/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: isGitHubPages ? "/instagram-post-analytics-ai" : "",
  assetPrefix: isGitHubPages ? "/instagram-post-analytics-ai/" : ""
};

export default nextConfig;
