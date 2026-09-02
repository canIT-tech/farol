import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Sem globals: true o auto-cleanup do testing-library não se registra sozinho.
afterEach(cleanup);
