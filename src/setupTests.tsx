import { vi } from "vitest";

// Monkeypatch URL.createObjectURL for js-untar
vi.stubGlobal("URL", { createObjectURL: () => "" });
