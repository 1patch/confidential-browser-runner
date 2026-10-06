// Acceptance-image-only synthetic inference. No real provider or credential.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
let calls = 0;
globalThis.fetch = async () => { throw new Error('Unexpected acceptance network request'); };
globalThis.__browserProofFetch = async (input, init) => {
  assert.equal(String(input), 'https://synthetic.invalid/v1/chat/completions');
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'glm-5-3-flash');
  if (JSON.stringify(body).includes('Second acceptance turn')) assert.ok(JSON.stringify(body).includes('Synthetic browser answer'), 'Session was not restored');
  calls++;
  if (calls > 2) throw new Error('Unexpected model iteration');
  const tool = calls === 1;
  if (!tool) assert.ok(JSON.stringify(body).includes('persistent proof'), 'Real browser observation was not returned');
  const delta = tool ? { role: 'assistant', tool_calls: [{ index: 0, id: 'call_fixture', type: 'function', function: { name: 'browser_exec', arguments: '{"code":"return await browser.snapshot();"}' } }] }
    : { role: 'assistant', content: 'Synthetic browser answer' };
  const chunk = { id: 'fixture', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: tool ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 120, completion_tokens: 3, total_tokens: 123 } };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
};
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'tinfoil') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`export class SecureClient {
    async ready() {} getVerificationDocument() { return {securityVerified:true}; }
    getBaseURL() { return 'https://synthetic.invalid/v1'; }
    fetch(input, init) { return globalThis.__browserProofFetch(input, init); }
  }`) };
  return next(specifier, context);
} });
