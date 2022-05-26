import React from "react";
import ReactDOMServer from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";

import App from "@src/App";
import { ProviderRegistry } from "@src/common/provider";

export function render(url: string) {
  return ReactDOMServer.renderToString(
    <React.StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </React.StrictMode>
  );
}

export const routes: ReadonlyArray<string> = [
  "/",
  ...ProviderRegistry.map((provider) => `/${provider.slug}`),
];
