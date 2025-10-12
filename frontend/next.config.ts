import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "rpc-websockets/dist/lib/client": require.resolve("rpc-websockets"),
      "rpc-websockets/dist/lib/client/websocket": require.resolve("rpc-websockets"),
    };
    config.resolve.fallback = { ...(config.resolve.fallback || {}), usb: false };
    return config;
  },
};

export default nextConfig;
