module.exports = {
  devServer: {
    headers: {
      "Content-Security-Policy":
        "default-src 'self' 'unsafe-inline' blob:; form-action 'none'; sandbox allow-scripts allow-same-origin allow-popups; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
};
