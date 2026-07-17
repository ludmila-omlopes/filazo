import type { NextConfig } from "next";
import { remoteImagePatterns } from "./src/lib/image-urls";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: remoteImagePatterns,
  },
  reactCompiler: true,
};

export default nextConfig;
