import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "bcryptjs", "jsonwebtoken"],
};

export default nextConfig;
