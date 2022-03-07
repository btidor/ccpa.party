module.exports = {
  devServer: {
    headers: {
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline'; form-action 'none'; navigate-to 'none'; sandbox allow-scripts allow-same-origin;",
    }
  }
}
