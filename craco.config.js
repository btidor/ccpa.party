module.exports = {
  devServer: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Content-Security-Policy":
        "default-src 'self' 'unsafe-inline' blob:; form-action 'none'; sandbox allow-scripts allow-same-origin allow-popups; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com",
    },
  },
  webpack: {
    configure: {
      resolve: {
        fallback: {
          // For @jlongster/sql.js
          crypto: false,
          fs: false,
          path: false,
        },
      },
    },
  },
};
