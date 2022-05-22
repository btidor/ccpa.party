const { sources } = require("webpack");

class AssetPathReplacementPlugin {
  name = "AssetPathReplacementPlugin";

  apply(compiler) {
    // Thank you https://stackoverflow.com/a/65535329!
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: Infinity,
        },
        (assets) => {
          for (const name in assets) {
            if (name === "index.html") {
              const stats = new Map(
                compilation
                  .getStats()
                  .toJson({
                    assets: true,
                    cachedAssets: true,
                  })
                  .assets.map((entry) => {
                    const parts = entry.name.split(".");
                    const base = parts.slice(0, -2).concat(parts.slice(-1));
                    return ["/" + base.join("."), "/" + entry.name];
                  })
              );

              const asset = compilation.getAsset(name);
              const contents = asset.source.source();
              const replaced = contents.replace(
                /%ASSET_URL%[^"'\n]+/g,
                (match) => {
                  const asset = match.slice("%ASSET_URL%".length);
                  const url = stats.get(asset);
                  console.error(stats, url);
                  if (!url) return match; // TODO
                  // throw new Error("Could not resolve asset: " + asset);
                  return url;
                }
              );
              compilation.updateAsset(name, new sources.RawSource(replaced));
            }
          }
        }
      );
    });
  }
}

module.exports = {
  devServer: {
    client: {
      // Makes auto-reload work both locally and via ngrok
      webSocketURL: "auto://0.0.0.0:0/ws",
    },
    headers: {
      "Content-Security-Policy": [
        "default-src 'none'",
        // Allow our scripts to run. Note: unsafe-inline is only needed for the
        // React dev tools extension.
        "script-src 'self' 'unsafe-inline' blob:",
        // Allow React to inject styles into the page.
        "style-src 'self' 'unsafe-inline'",
        // Additional resources:
        "font-src 'self'",
        "manifest-src 'self'",
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
        "img-src blob: data: 'self'",
        // For the Webpack dev server
        "connect-src 'self' wss://*",
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
      ].join("; "),
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  webpack: {
    plugins: [new AssetPathReplacementPlugin()],
  },
};
