import { createRequire as __calendarCreateRequire } from "node:module"; const require = __calendarCreateRequire(import.meta.url);

// src/platform/sandbox-errors.ts
var SandboxBusyError = class extends Error {
  constructor() {
    super("Sandbox execution rejected (409)");
    this.name = "SandboxBusyError";
  }
};

export {
  SandboxBusyError
};
