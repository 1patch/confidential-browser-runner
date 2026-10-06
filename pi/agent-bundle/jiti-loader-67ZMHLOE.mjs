import { createRequire as __calendarCreateRequire } from "node:module"; const require = __calendarCreateRequire(import.meta.url);
import {
  require_jiti
} from "./chunk-3HFYALRO.mjs";
import {
  __toESM
} from "./chunk-O6UGQVND.mjs";

// node_modules/@earendil-works/pi-coding-agent/node_modules/jiti/lib/jiti.mjs
var import_jiti = __toESM(require_jiti(), 1);
import { createRequire } from "node:module";
function onError(err) {
  throw err;
}
var nativeImport = (id) => import(id);
var _transform;
function lazyTransform(...args) {
  if (!_transform) {
    _transform = createRequire(import.meta.url)("../dist/babel.cjs");
  }
  return _transform(...args);
}
function createJiti(id, opts = {}) {
  if (!opts.transform) {
    opts = { ...opts, transform: lazyTransform };
  }
  return (0, import_jiti.default)(id, opts, {
    onError,
    nativeImport,
    createRequire
  });
}
export {
  createJiti
};
