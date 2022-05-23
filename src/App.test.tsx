import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { test } from "vitest";

import App from "@src/App";

test("renders learn react link", () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  screen.getByText(/ccpa\.party/i);
});
