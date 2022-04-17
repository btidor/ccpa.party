module.exports = {
  devServer: {
    headers: {
      "Content-Security-Policy": [
        "default-src 'none'",
        // Allow our scripts to run. Note: unsafe-inline is only needed for the
        // React dev tools extension.
        "script-src 'self' 'unsafe-inline'",
        // Allow React to inject styles into the page.
        "style-src 'unsafe-inline'",
        // Allow the FilePreview component to render images (via the <img> tag)
        // as well as PDFs and HTML documents (via the <iframe> tag).
        // * Per https://www.w3.org/TR/CSP3/#security-inherit-csp, blob and data
        //   iframes inherit the CSP of the parent, so this doesn't create an
        //   exfiltration channel.
        // * Note that blob iframes share the origin of the parent by default
        //   while data iframes run in an isolated, locked down pseudo-origin.
        //   We use blobs for efficiency, so we should make sure to always apply
        //   a sandbox *without* allow-same-origin, which has the ~same effect.
        "frame-src blob:",
        "img-src blob: data:",
        // For the Webpack dev server
        "connect-src 'self'",
        // Object embedding is pretty sketchy and plugins can bypass CSP
        // restrictions. Turn it all off.
        "object-src 'none'",
        // Blocking <base> tags avoids a vulnerability when using CSP nonces
        // with relative URLs. We don't use nonces, but sure.
        "base-uri 'none'",
        // Prevent this page from being loaded in an iframe (blocks clickjacking
        // attacks).
        "frame-ancestors 'none'",
        // Prevent all form submissions (makes it more difficult to exfiltrate
        // data).
        "form-action 'none'",
        // Lock things down a little extra (not sure how much this does).
        "sandbox allow-scripts allow-same-origin allow-popups",
      ].join("; "),
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
};
