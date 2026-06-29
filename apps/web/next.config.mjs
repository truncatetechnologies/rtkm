/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the shared workspace package (plain CommonJS) for the app.
  transpilePackages: ["@rtkm/shared"],
};

export default nextConfig;
