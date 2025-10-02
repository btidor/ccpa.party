// Slimmed-down version of the Plausible Analytics script,
// from github.com:plausible/analytics@948de2b4

// Copyright 2020 Plausible Insights OÜ
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

export default function plausible(): void {
  const location = window.location;
  const document = window.document;

  function warn(reason: string) {
    console.warn("Ignoring Event: " + reason);
  }

  const endpoint = import.meta.env.VITE_PLAUSIBLE_ORIGIN;
  if (!endpoint) return;

  if (
    /^localhost$|^127(\.[0-9]+){0,2}\.[0-9]+$|^\[::1?\]$/.test(
      location.hostname,
    ) ||
    location.protocol === "file:"
  )
    return warn("localhost");

  const w = window as Window & typeof globalThis & { [key: string]: unknown };
  if (w._phantom || w.__nightmare || w.navigator.webdriver || w.Cypress) return;

  const request = new XMLHttpRequest();
  request.open("POST", endpoint, true);
  request.setRequestHeader("Content-Type", "text/plain");
  request.send(
    JSON.stringify({
      n: "pageview",
      u: location.origin + "/", // report all URLs as `/`
      d: location.host,
      r: document.referrer || null,
      w: window.innerWidth,
    }),
  );
}
