import { createRequire as __calendarCreateRequire } from "node:module"; const require = __calendarCreateRequire(import.meta.url);
import {
  all_exports,
  build_exports,
  compat_exports,
  compile_exports,
  dist_exports,
  dist_exports2,
  dist_exports3,
  value_exports
} from "./chunk-IYLLIFKM.mjs";
import "./chunk-3GEPN7LD.mjs";
import "./chunk-5T3YKGG5.mjs";
import "./chunk-KG73PKZC.mjs";
import "./chunk-EC2M6EJ3.mjs";
import "./chunk-PGKAJBBR.mjs";
import "./chunk-OWUE5A46.mjs";
import "./chunk-O6UGQVND.mjs";

// node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/oauth.js
var oauth_exports = {};

// node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/virtual-modules.js
var VIRTUAL_MODULES = {
  typebox: build_exports,
  "typebox/compile": compile_exports,
  "typebox/value": value_exports,
  "@sinclair/typebox": build_exports,
  "@sinclair/typebox/compile": compile_exports,
  "@sinclair/typebox/value": value_exports,
  "@earendil-works/pi-agent-core": dist_exports2,
  "@earendil-works/pi-tui": dist_exports,
  // Extensions resolve the pi-ai root to the compat entrypoint (a strict
  // superset of the core entrypoint): existing extensions using the old
  // global API keep working at runtime until compat is removed.
  "@earendil-works/pi-ai": compat_exports,
  "@earendil-works/pi-ai/compat": compat_exports,
  "@earendil-works/pi-ai/oauth": oauth_exports,
  "@earendil-works/pi-ai/providers/all": all_exports,
  "@earendil-works/pi-coding-agent": dist_exports3,
  "@mariozechner/pi-agent-core": dist_exports2,
  "@mariozechner/pi-tui": dist_exports,
  "@mariozechner/pi-ai": compat_exports,
  "@mariozechner/pi-ai/compat": compat_exports,
  "@mariozechner/pi-ai/oauth": oauth_exports,
  "@mariozechner/pi-ai/providers/all": all_exports,
  "@mariozechner/pi-coding-agent": dist_exports3
};
export {
  VIRTUAL_MODULES
};
