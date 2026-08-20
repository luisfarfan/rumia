import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lockfiles exist in the repo root and in a parent directory, so Turbopack
  // guesses the wrong workspace root and warns on every build.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
