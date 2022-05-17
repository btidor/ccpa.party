// @flow

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
  var location = window.location;
  var document = window.document;

  function warn(reason) {
    console.warn("Ignoring Event: " + reason);
  }

  var endpoint = process.env.REACT_APP_PLAUSIBLE_ORIGIN;
  if (!endpoint) return warn("not configured");

  function trigger() {
    if (
      /^localhost$|^127(\.[0-9]+){0,2}\.[0-9]+$|^\[::1?\]$/.test(
        location.hostname
      ) ||
      location.protocol === "file:"
    )
      return warn("localhost");
    if (
      window._phantom ||
      window.__nightmare ||
      window.navigator.webdriver ||
      window.Cypress
    )
      return;

    var payload = {};
    payload.n = "pageview";
    payload.u = location.origin + "/"; // report all URLs as `/`
    payload.d = location.host;
    payload.r = document.referrer || null;
    payload.w = window.innerWidth;

    var request = new XMLHttpRequest();
    request.open("POST", endpoint, true);
    request.setRequestHeader("Content-Type", "text/plain");

    request.send(JSON.stringify(payload));
  }

  var lastPage;
  function page() {
    if (lastPage === location.pathname) return;
    lastPage = location.pathname;
    trigger();
  }

  function handleVisibilityChange() {
    if (!lastPage && document.visibilityState === "visible") {
      page();
    }
  }

  if (document.visibilityState === "prerender") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  } else {
    page();
  }
}
