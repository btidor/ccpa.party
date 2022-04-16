module.exports = {
  devServer: {
    headers: {
      "Content-Security-Policy": [
        "default-src",
        // TODO: unsafe-inline is needed for React dev tools
        "script-src 'self' 'unsafe-inline'",
        "img-src blob: data:",
        "style-src 'unsafe-inline'",
        "frame-ancestors 'none'",
        "form-action 'none'",
        "sandbox allow-scripts allow-same-origin allow-popups",
        // TODO: remove these!
        "connect-src 'self'", // for Webpack dev server
        "frame-src blob: data:", // for HTML files
        "object-src blob: data:", // for PDFs
      ].join(";"),
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
};
