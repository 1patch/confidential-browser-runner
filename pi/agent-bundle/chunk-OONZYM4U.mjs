import { createRequire as __calendarCreateRequire } from "node:module"; const require = __calendarCreateRequire(import.meta.url);

// node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/utils/headers.js
function headersToRecord(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}
function providerHeadersToRecord(headers) {
  if (!headers)
    return void 0;
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== null)
      result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : void 0;
}

export {
  headersToRecord,
  providerHeadersToRecord
};
