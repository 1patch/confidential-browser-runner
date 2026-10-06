import { createRequire as __calendarCreateRequire } from "node:module"; const require = __calendarCreateRequire(import.meta.url);

// node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/utils/sanitize-unicode.js
function sanitizeSurrogates(text) {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

export {
  sanitizeSurrogates
};
