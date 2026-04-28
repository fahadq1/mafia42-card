import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const pagesBasePath = isGitHubPages && repositoryName ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath: pagesBasePath || undefined,
  assetPrefix: pagesBasePath || "./",
  env: {
    NEXT_PUBLIC_PAGES_BASE_PATH: pagesBasePath,
  },
};

export default nextConfig;
