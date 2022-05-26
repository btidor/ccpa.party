import { render, screen } from "@testing-library/react";
import { test } from "vitest";

import App from "@src/App";
import { BrowserRouter } from "@src/common/router";

test("renders learn react link", () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  screen.getByText(/ccpa\.party/i);
});
