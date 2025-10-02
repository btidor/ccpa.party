import React from "react";
import ReactDOMServer from "react-dom/server";

import App from "@src/App";
import { ProviderRegistry } from "@src/common/provider";

export function render(url: string) {
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <App location={url} />
    </React.StrictMode>,
  );
}

export const routes: ReadonlyArray<string> = [
  "/",
  ...ProviderRegistry.map((provider) => `/${provider.slug}`),
];
