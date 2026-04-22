import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js Node.js Worker + WASM kullanir; bundler disina cikarmak gerekir.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
