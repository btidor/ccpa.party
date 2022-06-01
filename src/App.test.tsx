import { render, screen } from "@testing-library/react";
import { test } from "vitest";

import App from "@src/App";

test("renders learn react link", () => {
  render(<App location="/" />);
  screen.getByText(/ccpa\.party/i);
});
