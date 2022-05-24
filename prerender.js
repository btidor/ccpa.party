const fs = require("fs");
const prettier = require("prettier");

const tag = "<!-- PRERENDER -->";
const routes = [
  "/",
  "/amazon",
  "/apple",
  "/discord",
  "/facebook",
  "/github",
  "/google",
  "/netflix",
  "/slack",
];

// Monkeypatch browser APIs
const HappyDOM = require("@happy-dom/global-registrator");
HappyDOM.GlobalRegistrator.register();
window.URL = { createObjectURL: () => "" };

// Monkeypatch code bundle
let code = fs.readFileSync("dist/.server/main-static.js", "utf-8");
code = code.replace(`require("react-markdown")`, `import("react-markdown")`);
code = code.replace(`require("remark-gfm")`, `import("remark-gfm")`);
fs.writeFileSync("dist/.server/main-static.js", code);

// Then load code bundle
const { render } = require("./dist/.server/main-static.js");

// Pre-render routes
(async () => {
  const template = fs.readFileSync("dist/index.html", "utf-8");

  if (!template.includes(tag))
    throw new Error(`Can't find ${tag} in dist/index.html`);

  for (const url of routes) {
    const content = await render(url);
    const html = prettier.format(template.replace(tag, content), {
      parser: "html",
    });

    const path = `dist${url === "/" ? "/index" : url}.html`;
    fs.writeFileSync(path, html);
    console.log("Pre-rendered:", path);
  }

  const html = prettier.format(template.replace(tag, ""), { parser: "html" });
  fs.writeFileSync("dist/200.html", html);
  fs.rmSync("dist/.server/", { recursive: true });
})();
