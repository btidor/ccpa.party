import React from "react";
import ReactDOMClient from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "App";
import plausible from "common/plausible";

import "index.css";

import faviconSvg from "img/favicon.svg";
import faviconDarkSvg from "img/favicon-dark.svg";

// Tell Webpack to also emit these resources
/* eslint-disable @typescript-eslint/no-unused-vars */
import _1 from "img/favicon.png";
import _2 from "img/favicon-dark.png";
import _3 from "img/logo.png";
/* eslint-enable */

const root = ReactDOMClient.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

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

  if (dark.matches) {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = faviconDarkSvg;
    icon.type = "image/svg+xml";
    head.appendChild(icon);
  } else {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = faviconSvg;
    icon.type = "image/svg+xml";
    head.appendChild(icon);
  }
};
dark.addListener(swapIcons);
swapIcons();

plausible();
