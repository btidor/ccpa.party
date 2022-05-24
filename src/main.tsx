import React from "react";
import ReactDOMClient from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@src/App";
import plausible from "@src/common/plausible";

import "@src/index.css";

import notoProvider from "@src/fonts/noto-emoji-provider-subset.woff2";
import plexMono from "@src/fonts/plex-mono-subset.woff2";
import plexSans from "@src/fonts/plex-sans.woff2";

import faviconDarkSvg from "@src/img/favicon-dark.svg";
import faviconSvg from "@src/img/favicon.svg";

const root = ReactDOMClient.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

const addLink = (rel: string, href: string, opts: { [key: string]: any }) => {
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  for (const [k, v] of Object.entries(opts)) {
    (link as any)[k] = v;
  }
  document.head.appendChild(link);
};

const dark = window.matchMedia("(prefers-color-scheme: dark)");
const swapIcons = () => {
  // Firefox is the only browser that handles SVG favicons correctly. *Don't*
  // switch to faviconDarkSvg in dark mode --- it omits the media query because
  // Chrome incorrectly renders all favicons with `prefers-color-scheme: light`.
  //
  // We also leave the alternate, non-SVG icon for Safari alone: Safari renders
  // the favicon over a white box, so we should always use the light-mode
  // version in order for it to show up.
  //
  if (navigator.userAgent.includes("Firefox")) return;

  const head = document.head;
  if (!head) return;

  const links = Array.from(head.getElementsByTagName("link"));
  links.find((x) => x.rel === "icon")?.remove();

  addLink("icon", dark.matches ? faviconDarkSvg : faviconSvg, {
    type: "image/svg+xml",
  });
};
dark.addListener(swapIcons);
swapIcons();

plausible();

// Preload remaining assets used by the app, but only after the page loads, to
// avoid blocking critical resources.
window.addEventListener("load", () => {
  const opts = {
    as: "font",
    type: "font/woff2",
    crossOrigin: "",
  };
  addLink("preload", notoProvider, opts);
  addLink("preload", plexMono, opts);
  addLink("preload", plexSans, opts);
});
