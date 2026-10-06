import { createRequire as __calendarCreateRequire } from "node:module"; const require = __calendarCreateRequire(import.meta.url);
import {
  SandboxBusyError
} from "./chunk-5PHQVXQN.mjs";
import "./chunk-O6UGQVND.mjs";

// src/platform/tinfoil-pool.ts
import { createPrivateKey, randomUUID as randomUUID2 } from "node:crypto";
import { constants } from "node:fs";
import { open as open2 } from "node:fs/promises";
import { join as join2, normalize as normalize2 } from "node:path";

// src/platform/attested-client.ts
import { SecureClient } from "tinfoil";

// node_modules/hpke/index.js
function ComputeNonce(base_nonce, seq, Nn) {
  const nonce = new Uint8Array(Nn);
  nonce.set(base_nonce);
  let s = seq;
  for (let i = Nn - 1; i >= 0 && s > 0; i--) {
    nonce[i] = nonce[i] ^ s & 255;
    s = Math.floor(s / 256);
  }
  return nonce;
}
function MaxSeq(Nn) {
  return Math.min(2 ** (8 * Nn) - 1, Number.MAX_SAFE_INTEGER);
}
function IncrementSeq(seq, maxSeq) {
  if (seq >= maxSeq) {
    throw new MessageLimitReachedError("Sequence number overflow");
  }
  return ++seq;
}
async function ContextExport(suite, exporterSecret, exporterContext, L) {
  checkUint8Array(exporterContext, "exporterContext");
  const stages = KDFStages(suite.KDF);
  if (!Number.isInteger(L) || L <= 0 || L > 65535) {
    throw new TypeError('"L" must be a positive integer not exceeding 65535');
  }
  if (stages === 2 && L > 255 * suite.KDF.Nh) {
    throw new TypeError('"L" must not exceed 255*Nh of the cipher suite KDF');
  }
  const Export = stages === 1 ? Export_OneStage : Export_TwoStage;
  return await Export(suite.KDF, suite.id, exporterSecret, exporterContext, L);
}
var Mutex = class {
  #locked = Promise.resolve();
  async lock() {
    let releaseLock;
    const nextLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    const previousLock = this.#locked;
    this.#locked = nextLock;
    await previousLock;
    return releaseLock;
  }
};
function createContextState(suite, mode, key, base_nonce, exporter_secret) {
  return {
    suite,
    mode,
    key,
    base_nonce,
    exporter_secret,
    max_seq: MaxSeq(suite.AEAD.Nn),
    seq: 0,
    mutex: void 0
  };
}
var SenderContext = class {
  #state;
  constructor(suite, mode, key, base_nonce, exporter_secret) {
    this.#state = createContextState(suite, mode, key, base_nonce, exporter_secret);
  }
  get mode() {
    return this.#state.mode;
  }
  get seq() {
    return this.#state.seq;
  }
  async Seal(plaintext, aad) {
    checkUint8Array(plaintext, "plaintext");
    aad ??= new Uint8Array();
    checkUint8Array(aad, "aad");
    const state = this.#state;
    if (state.suite.AEAD.id === EXPORT_ONLY) {
      throw new TypeError("Export-only AEAD cannot be used with Seal");
    }
    state.mutex ??= new Mutex();
    const release = await state.mutex.lock();
    let ct;
    try {
      ct = await state.suite.AEAD.Seal(
        state.key,
        ComputeNonce(state.base_nonce, state.seq, state.suite.AEAD.Nn),
        aad,
        plaintext
      );
      state.seq = IncrementSeq(state.seq, state.max_seq);
      return ct;
    } finally {
      release();
    }
  }
  async Export(exporterContext, length) {
    return await ContextExport(
      this.#state.suite,
      this.#state.exporter_secret,
      exporterContext,
      length
    );
  }
  get Nt() {
    return this.#state.suite.AEAD.Nt;
  }
};
var RecipientContext = class {
  #state;
  constructor(suite, mode, key, base_nonce, exporter_secret) {
    this.#state = createContextState(suite, mode, key, base_nonce, exporter_secret);
  }
  get mode() {
    return this.#state.mode;
  }
  get seq() {
    return this.#state.seq;
  }
  async Open(ciphertext, aad) {
    checkUint8Array(ciphertext, "ciphertext");
    aad ??= new Uint8Array();
    checkUint8Array(aad, "aad");
    const state = this.#state;
    if (state.suite.AEAD.id === EXPORT_ONLY) {
      throw new TypeError("Export-only AEAD cannot be used with Open");
    }
    state.mutex ??= new Mutex();
    const release = await state.mutex.lock();
    try {
      let pt;
      try {
        pt = await state.suite.AEAD.Open(
          state.key,
          ComputeNonce(state.base_nonce, state.seq, state.suite.AEAD.Nn),
          aad,
          ciphertext
        );
      } catch (cause) {
        if (cause instanceof MessageLimitReachedError || cause instanceof NotSupportedError) {
          throw cause;
        }
        throw new OpenError("AEAD decryption failed", { cause });
      }
      state.seq = IncrementSeq(state.seq, state.max_seq);
      return pt;
    } finally {
      release();
    }
  }
  async Export(exporterContext, length) {
    return await ContextExport(
      this.#state.suite,
      this.#state.exporter_secret,
      exporterContext,
      length
    );
  }
};
var validate = (factory, type) => {
  try {
    const result = factory();
    if (result.type !== type) {
      throw new Error(`Invalid "${type}" return discriminator`);
    }
    return result;
  } catch (cause) {
    throw new TypeError(`Invalid "${type}"`, { cause });
  }
};
var CipherSuite = class {
  #suite;
  constructor(KEM, KDF, AEAD) {
    const kem = validate(KEM, "KEM");
    const kdf2 = validate(KDF, "KDF");
    const aead2 = validate(AEAD, "AEAD");
    this.#suite = {
      KEM: kem,
      KDF: kdf2,
      AEAD: aead2,
      id: concat(L_HPKE, I2OSP(kem.id, 2), I2OSP(kdf2.id, 2), I2OSP(aead2.id, 2))
    };
  }
  get KEM() {
    return {
      id: this.#suite.KEM.id,
      name: this.#suite.KEM.name,
      Nsecret: this.#suite.KEM.Nsecret,
      Nenc: this.#suite.KEM.Nenc,
      Npk: this.#suite.KEM.Npk,
      Nsk: this.#suite.KEM.Nsk
    };
  }
  get KDF() {
    return {
      id: this.#suite.KDF.id,
      name: this.#suite.KDF.name,
      stages: this.#suite.KDF.stages,
      Nh: this.#suite.KDF.Nh
    };
  }
  get AEAD() {
    return {
      id: this.#suite.AEAD.id,
      name: this.#suite.AEAD.name,
      Nk: this.#suite.AEAD.Nk,
      Nn: this.#suite.AEAD.Nn,
      Nt: this.#suite.AEAD.Nt
    };
  }
  async GenerateKeyPair(extractable) {
    extractable ??= false;
    checkExtractable(extractable);
    return await this.#suite.KEM.GenerateKeyPair(extractable);
  }
  async DeriveKeyPair(ikm, extractable) {
    extractable ??= false;
    checkExtractable(extractable);
    checkUint8Array(ikm, "ikm");
    if (ikm.byteLength < this.#suite.KEM.Nsk) {
      throw new DeriveKeyPairError('Insufficient "ikm" length');
    }
    try {
      return await this.#suite.KEM.DeriveKeyPair(ikm, extractable);
    } catch (cause) {
      if (cause instanceof NotSupportedError) {
        throw cause;
      }
      throw new DeriveKeyPairError("Key derivation failed", { cause });
    }
  }
  async SerializePrivateKey(privateKey) {
    isKey(privateKey, "private", true);
    return await this.#suite.KEM.SerializePrivateKey(privateKey);
  }
  async SerializePublicKey(publicKey) {
    isKey(publicKey, "public", true);
    return await this.#suite.KEM.SerializePublicKey(publicKey);
  }
  async DeserializePrivateKey(privateKey, extractable) {
    extractable ??= false;
    checkExtractable(extractable);
    checkUint8Array(privateKey, "privateKey");
    try {
      if (privateKey.byteLength !== this.#suite.KEM.Nsk) {
        throw new Error('Invalid "privateKey" length');
      }
      return await this.#suite.KEM.DeserializePrivateKey(privateKey, extractable);
    } catch (cause) {
      if (cause instanceof NotSupportedError) {
        throw cause;
      }
      throw new DeserializeError("Private key deserialization failed", { cause });
    }
  }
  async DeserializePublicKey(publicKey) {
    checkUint8Array(publicKey, "publicKey");
    try {
      if (publicKey.byteLength !== this.#suite.KEM.Npk) {
        throw new Error('Invalid "publicKey" length');
      }
      return await this.#suite.KEM.DeserializePublicKey(publicKey);
    } catch (cause) {
      if (cause instanceof NotSupportedError) {
        throw cause;
      }
      throw new DeserializeError("Public key deserialization failed", { cause });
    }
  }
  async Seal(publicKey, plaintext, options) {
    if (this.#suite.AEAD.id === EXPORT_ONLY) {
      throw new TypeError("Export-only AEAD cannot be used with Seal");
    }
    const { encapsulatedSecret, ctx } = await this.SetupSender(publicKey, options);
    const ciphertext = await ctx.Seal(plaintext, options?.aad);
    return { encapsulatedSecret, ciphertext };
  }
  async Open(privateKey, encapsulatedSecret, ciphertext, options) {
    if (this.#suite.AEAD.id === EXPORT_ONLY) {
      throw new TypeError("Export-only AEAD cannot be used with Open");
    }
    const ctx = await this.SetupRecipient(privateKey, encapsulatedSecret, options);
    return await ctx.Open(ciphertext, options?.aad);
  }
  async SendExport(publicKey, exporterContext, length, options) {
    const { encapsulatedSecret, ctx } = await this.SetupSender(publicKey, options);
    const exportedSecret = await ctx.Export(exporterContext, length);
    return { encapsulatedSecret, exportedSecret };
  }
  async ReceiveExport(privateKey, encapsulatedSecret, exporterContext, length, options) {
    const ctx = await this.SetupRecipient(privateKey, encapsulatedSecret, options);
    return await ctx.Export(exporterContext, length);
  }
  async SetupSender(publicKey, options) {
    isKey(publicKey, "public");
    let shared_secret;
    let enc;
    try {
      const result = await this.#suite.KEM.Encap(publicKey);
      shared_secret = result.shared_secret;
      enc = result.enc;
    } catch (cause) {
      if (cause instanceof ValidationError || cause instanceof NotSupportedError) {
        throw cause;
      }
      throw new EncapError("Encapsulation failed", { cause });
    }
    const mode = options?.psk?.byteLength ? MODE_PSK : MODE_BASE;
    const { key, base_nonce, exporter_secret } = await KeySchedule(
      this.#suite,
      mode,
      shared_secret,
      options?.info,
      options?.psk,
      options?.pskId
    );
    const ctx = new SenderContext(this.#suite, mode, key, base_nonce, exporter_secret);
    return { encapsulatedSecret: enc, ctx };
  }
  async SetupRecipient(privateKey, encapsulatedSecret, options) {
    const { skR, pkR } = this.#extractRecipientKeys(privateKey);
    checkUint8Array(encapsulatedSecret, "encapsulatedSecret");
    if (encapsulatedSecret.byteLength !== this.#suite.KEM.Nenc) {
      throw new DecapError("Invalid encapsulated secret length");
    }
    let shared_secret;
    try {
      shared_secret = await this.#suite.KEM.Decap(encapsulatedSecret, skR, pkR);
    } catch (cause) {
      if (cause instanceof ValidationError || cause instanceof NotSupportedError) {
        throw cause;
      }
      throw new DecapError("Decapsulation failed", { cause });
    }
    const mode = options?.psk?.byteLength ? MODE_PSK : MODE_BASE;
    const { key, base_nonce, exporter_secret } = await KeySchedule(
      this.#suite,
      mode,
      shared_secret,
      options?.info,
      options?.psk,
      options?.pskId
    );
    return new RecipientContext(this.#suite, mode, key, base_nonce, exporter_secret);
  }
  #extractRecipientKeys(skR) {
    if (isKeyPair(skR)) {
      return { skR: skR.privateKey, pkR: skR.publicKey };
    }
    isKey(skR, "private");
    return { skR, pkR: void 0 };
  }
};
var ValidationError = class _ValidationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "ValidationError";
    Error.captureStackTrace?.(this, _ValidationError);
  }
};
var DeserializeError = class _DeserializeError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "DeserializeError";
    Error.captureStackTrace?.(this, _DeserializeError);
  }
};
var EncapError = class _EncapError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "EncapError";
    Error.captureStackTrace?.(this, _EncapError);
  }
};
var DecapError = class _DecapError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "DecapError";
    Error.captureStackTrace?.(this, _DecapError);
  }
};
var OpenError = class _OpenError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "OpenError";
    Error.captureStackTrace?.(this, _OpenError);
  }
};
var MessageLimitReachedError = class _MessageLimitReachedError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "MessageLimitReachedError";
    Error.captureStackTrace?.(this, _MessageLimitReachedError);
  }
};
var DeriveKeyPairError = class _DeriveKeyPairError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "DeriveKeyPairError";
    Error.captureStackTrace?.(this, _DeriveKeyPairError);
  }
};
var NotSupportedError = class _NotSupportedError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "NotSupportedError";
    Error.captureStackTrace?.(this, _NotSupportedError);
  }
};
var MODE_BASE = 0;
var MODE_PSK = 1;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
function slice(buffer, start, end) {
  return Uint8Array.prototype.slice.call(buffer, start, end);
}
function encode(string) {
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127) {
      throw new TypeError("Input string must contain only ASCII characters");
    }
    bytes[i] = code;
  }
  return bytes;
}
var L_HPKE_v1 = /* @__PURE__ */ encode("HPKE-v1");
var L_HPKE = /* @__PURE__ */ encode("HPKE");
var L_sec = /* @__PURE__ */ encode("sec");
var L_secret = /* @__PURE__ */ encode("secret");
var L_key = /* @__PURE__ */ encode("key");
var L_base_nonce = /* @__PURE__ */ encode("base_nonce");
var L_exp = /* @__PURE__ */ encode("exp");
var L_psk_id_hash = /* @__PURE__ */ encode("psk_id_hash");
var L_info_hash = /* @__PURE__ */ encode("info_hash");
function lengthPrefixed(x) {
  return concat(I2OSP(x.byteLength, 2), x);
}
async function LabeledDerive(KDF, suite_id, ikm, label, context, L) {
  const labeled_ikm = concat(ikm, L_HPKE_v1, suite_id, lengthPrefixed(label), I2OSP(L, 2), context);
  return await KDF.Derive(labeled_ikm, L);
}
async function Export_OneStage(KDF, suite_id, exporter_secret, exporter_context, L) {
  checkLength(exporter_context, "Exporter context", MAX_LENGTH_ONE_STAGE);
  return await LabeledDerive(KDF, suite_id, exporter_secret, L_sec, exporter_context, L);
}
async function CombineSecrets_OneStage(suite, mode, shared_secret, info, psk, psk_id) {
  checkLength(psk, "PSK", MAX_LENGTH_ONE_STAGE);
  checkLength(psk_id, "PSK ID", MAX_LENGTH_ONE_STAGE);
  checkLength(info, "Info", MAX_LENGTH_ONE_STAGE);
  const secrets = concat(lengthPrefixed(psk), lengthPrefixed(shared_secret));
  const context = concat(I2OSP(mode, 1), lengthPrefixed(psk_id), lengthPrefixed(info));
  const secret = await LabeledDerive(
    suite.KDF,
    suite.id,
    secrets,
    L_secret,
    context,
    suite.AEAD.Nk + suite.AEAD.Nn + suite.KDF.Nh
  );
  const key = slice(secret, 0, suite.AEAD.Nk);
  const base_nonce = slice(secret, suite.AEAD.Nk, suite.AEAD.Nk + suite.AEAD.Nn);
  const exporter_secret = slice(secret, suite.AEAD.Nk + suite.AEAD.Nn);
  return { key, base_nonce, exporter_secret };
}
var MAX_LENGTH_TWO_STAGE = 65535;
var MAX_LENGTH_ONE_STAGE = 65535;
function checkLength(data, name, maxLength) {
  if (data.byteLength > maxLength) {
    throw new TypeError(`${name} length must not exceed ${maxLength} bytes`);
  }
}
function checkUint8Array(input, name) {
  if (!(input instanceof Uint8Array)) {
    throw new TypeError(`"${name}" must be Uint8Array`);
  }
  if (typeof SharedArrayBuffer !== "undefined" && input.buffer instanceof SharedArrayBuffer) {
    throw new TypeError(`"${name}" must not be backed by a SharedArrayBuffer`);
  }
}
function checkExtractable(extractable) {
  if (typeof extractable !== "boolean") {
    throw new TypeError('"extractable" must be boolean');
  }
}
async function CombineSecrets_TwoStage(suite, mode, shared_secret, info, psk, psk_id) {
  checkLength(psk, "PSK", MAX_LENGTH_TWO_STAGE);
  checkLength(psk_id, "PSK ID", MAX_LENGTH_TWO_STAGE);
  checkLength(info, "Info", MAX_LENGTH_TWO_STAGE);
  const [psk_id_hash, info_hash] = await Promise.all([
    LabeledExtract(suite.KDF, suite.id, new Uint8Array(), L_psk_id_hash, psk_id),
    LabeledExtract(suite.KDF, suite.id, new Uint8Array(), L_info_hash, info)
  ]);
  const key_schedule_context = concat(I2OSP(mode, 1), psk_id_hash, info_hash);
  const secret = await LabeledExtract(suite.KDF, suite.id, shared_secret, L_secret, psk);
  if (suite.AEAD.id === EXPORT_ONLY) {
    const exporter_secret2 = await LabeledExpand(
      suite.KDF,
      suite.id,
      secret,
      L_exp,
      key_schedule_context,
      suite.KDF.Nh
    );
    return { key: new Uint8Array(), base_nonce: new Uint8Array(), exporter_secret: exporter_secret2 };
  }
  const [key, base_nonce, exporter_secret] = await Promise.all([
    LabeledExpand(suite.KDF, suite.id, secret, L_key, key_schedule_context, suite.AEAD.Nk),
    LabeledExpand(suite.KDF, suite.id, secret, L_base_nonce, key_schedule_context, suite.AEAD.Nn),
    LabeledExpand(suite.KDF, suite.id, secret, L_exp, key_schedule_context, suite.KDF.Nh)
  ]);
  return { key, base_nonce, exporter_secret };
}
async function Export_TwoStage(KDF, suite_id, exporter_secret, exporter_context, L) {
  checkLength(exporter_context, "Exporter context", MAX_LENGTH_TWO_STAGE);
  return await LabeledExpand(KDF, suite_id, exporter_secret, L_sec, exporter_context, L);
}
async function LabeledExtract(KDF, suite_id, salt, label, ikm) {
  const labeled_ikm = concat(L_HPKE_v1, suite_id, label, ikm);
  return await KDF.Extract(salt, labeled_ikm);
}
async function LabeledExpand(KDF, suite_id, prk, label, info, L) {
  const labeled_info = concat(I2OSP(L, 2), L_HPKE_v1, suite_id, label, info);
  return await KDF.Expand(prk, labeled_info, L);
}
function isKeyPair(skR) {
  if (!skR || typeof skR !== "object") return false;
  if ("publicKey" in skR && "privateKey" in skR) {
    const pkR = skR.publicKey;
    skR = skR.privateKey;
    try {
      isKey(pkR, "public");
      isKey(skR, "private");
      if (pkR.algorithm.name !== skR.algorithm.name) {
        throw new TypeError("key pair algorithms do not match");
      }
    } catch (cause) {
      throw new TypeError('Invalid "privateKey"', { cause });
    }
    return true;
  }
  return false;
}
function isKey(key, type, extractable) {
  const k = key;
  if (typeof k.algorithm !== "object" || typeof k.algorithm.name !== "string" || typeof k.extractable !== "boolean" || typeof k.type !== "string" || k.type !== type) {
    throw new TypeError(`Invalid "${type}Key"`);
  }
  if (extractable && k.extractable !== true) {
    throw new TypeError(`"${type}Key" must be extractable`);
  }
}
function I2OSP(n, w) {
  if (!Number.isSafeInteger(w) || w <= 0) {
    throw new Error("w must be a positive safe integer");
  }
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error("n must be a non-negative safe integer");
  }
  const max = Math.pow(256, w);
  if (n >= max) {
    throw new Error("n too large to fit in w-length byte string");
  }
  const ret = new Uint8Array(w);
  let num = n;
  for (let i = 0; i < w && num; i++) {
    ret[w - (i + 1)] = num % 256;
    num = Math.floor(num / 256);
  }
  return ret;
}
function KDFStages(KDF) {
  if (KDF.stages === 1 || KDF.stages === 2) {
    return KDF.stages;
  }
  throw new Error("unreachable");
}
async function KeySchedule(suite, mode, shared_secret, info, psk, pskId) {
  info ??= new Uint8Array();
  checkUint8Array(info, "info");
  psk ??= new Uint8Array();
  checkUint8Array(psk, "psk");
  pskId ??= new Uint8Array();
  checkUint8Array(pskId, "pskId");
  const stages = KDFStages(suite.KDF);
  const CombineSecrets = stages === 1 ? CombineSecrets_OneStage : CombineSecrets_TwoStage;
  VerifyPSKInputs(psk, pskId);
  return await CombineSecrets(suite, mode, shared_secret, info, psk, pskId);
}
function VerifyPSKInputs(psk, psk_id) {
  if (psk.byteLength && psk_id.byteLength) {
    if (psk.byteLength < 32) {
      throw new TypeError("Insufficient PSK length");
    }
    return;
  }
  if (!psk.byteLength && !psk_id.byteLength) {
    return;
  }
  throw new TypeError("Inconsistent PSK inputs");
}
var EXPORT_ONLY = 65535;
var AES_GCM_P_MAX = 2 ** 36 - 31;
var CHACHA20_POLY1305_P_MAX = 2 ** 38 - 64;

// node_modules/@noble/ciphers/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
var atitle = (title) => title ? `"${title}" ` : "";
function abool(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function anumber(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes(value, length, title = "") {
  if (isBytes(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber(length, "length");
  const bytes = isBytes(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes)
    throw new TypeError(message);
  throw new RangeError(message);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function aoutput32(out, instance) {
  aoutput(out, instance);
  if (!isAligned32(out))
    throw new Error("invalid output, must be aligned");
}
function u8(arr) {
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
var swap8IfBE = isLE ? (n) => n : (n) => byteSwap(n) >>> 0;
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
var swap32IfBE = isLE ? (u) => u : byteSwap32;
function equalBytes(a, b) {
  a = abytes(a);
  b = abytes(b);
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function wrapMacConstructor(keyLen, macCons, fromMsg) {
  const mac = macCons;
  const getArgs = fromMsg || (() => []);
  const macC = (msg, key) => mac(key, ...getArgs(msg)).update(msg).digest();
  const tmp = mac(new Uint8Array(keyLen), ...getArgs(new Uint8Array(0)));
  macC.outputLen = tmp.outputLen;
  macC.blockLen = tmp.blockLen;
  macC.create = (key, ...args) => mac(key, ...args);
  return macC;
}
var wrapCipher = /* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
  function wrappedCipher(key, ...args) {
    abytes(key, void 0, "key");
    if (params.nonceLength !== void 0) {
      const nonce = args[0];
      abytes(nonce, params.varSizeNonce ? void 0 : params.nonceLength, "nonce");
    }
    const tagl = params.tagLength;
    const aadStart = params.nonceLength !== void 0 ? 1 : 0;
    if (!params.withAAD) {
      for (let i = aadStart; i < args.length; i++)
        if (isBytes(args[i]))
          throw new Error("AAD not supported");
    }
    if (params.withAAD && args[aadStart] !== void 0)
      abytes(args[aadStart], void 0, "AAD");
    const cipher = constructor(key, ...args);
    const checkOutput = (fnLength, output) => {
      if (output !== void 0) {
        if (fnLength !== 2)
          throw new Error("cipher output not supported");
        abytes(output, void 0, "output");
      }
    };
    let called = false;
    const wrCipher = {
      encrypt(data, output) {
        if (called)
          throw new Error("cannot encrypt() twice with same key + nonce");
        called = true;
        abytes(data, void 0, "data");
        checkOutput(cipher.encrypt.length, output);
        return cipher.encrypt(data, output);
      },
      decrypt(data, output) {
        abytes(data, void 0, "data");
        if (tagl && data.length < tagl)
          throw new Error('"ciphertext" expected length >= tagLength=' + tagl);
        checkOutput(cipher.decrypt.length, output);
        return cipher.decrypt(data, output);
      }
    };
    return wrCipher;
  }
  Object.assign(wrappedCipher, params);
  return wrappedCipher;
};
function getOutput(expectedLength, out, onlyAligned = true) {
  if (out === void 0)
    return new Uint8Array(expectedLength);
  abytes(out, expectedLength, "output");
  if (onlyAligned && !isAligned32(out))
    throw new Error("invalid output, must be aligned");
  return out;
}
function u64Lengths(dataLength, aadLength, isLE2) {
  anumber(dataLength);
  anumber(aadLength);
  abool(isLE2);
  const num = new Uint8Array(16);
  const view = createView(num);
  view.setBigUint64(0, BigInt(aadLength), isLE2);
  view.setBigUint64(8, BigInt(dataLength), isLE2);
  return num;
}
function isAligned32(bytes) {
  return bytes.byteOffset % 4 === 0;
}
function copyBytes(bytes) {
  return Uint8Array.from(abytes(bytes));
}

// node_modules/@noble/ciphers/_polyval.js
var BLOCK_SIZE = 16;
var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
var ZEROS32 = /* @__PURE__ */ u32(ZEROS16);
var POLY = 225;
var mul2 = (s0, s1, s2, s3) => {
  const hiBit = s3 & 1;
  return {
    s3: s2 << 31 | s3 >>> 1,
    s2: s1 << 31 | s2 >>> 1,
    s1: s0 << 31 | s1 >>> 1,
    // NIST SP 800-38D §6.3 applies `V >> 1` and XORs R on carry. In this
    // 4x32-bit split, R = 0xe1 || 0^120 lives in the top byte of s0.
    s0: s0 >>> 1 ^ POLY << 24 & -(hiBit & 1)
    // reduce % poly
  };
};
var swapLE = (n) => (n >>> 0 & 255) << 24 | (n >>> 8 & 255) << 16 | (n >>> 16 & 255) << 8 | n >>> 24 & 255 | 0;
var estimateWindow = (bytes) => {
  if (bytes > 64 * 1024)
    return 8;
  if (bytes > 1024)
    return 4;
  return 2;
};
var GHASH = class {
  blockLen = BLOCK_SIZE;
  outputLen = BLOCK_SIZE;
  s0 = 0;
  s1 = 0;
  s2 = 0;
  s3 = 0;
  finished = false;
  destroyed = false;
  t;
  W;
  windowSize;
  // We select bits per window adaptively based on expectedLength
  constructor(key, expectedLength) {
    abytes(key, 16, "key");
    key = copyBytes(key);
    const kView = createView(key);
    let k0 = kView.getUint32(0, false);
    let k1 = kView.getUint32(4, false);
    let k2 = kView.getUint32(8, false);
    let k3 = kView.getUint32(12, false);
    const doubles = [];
    for (let i = 0; i < 128; i++) {
      doubles.push({ s0: swapLE(k0), s1: swapLE(k1), s2: swapLE(k2), s3: swapLE(k3) });
      ({ s0: k0, s1: k1, s2: k2, s3: k3 } = mul2(k0, k1, k2, k3));
    }
    const W = estimateWindow(expectedLength || 1024);
    if (![1, 2, 4, 8].includes(W))
      throw new Error("ghash: invalid window size, expected 2, 4 or 8");
    this.W = W;
    const bits = 128;
    const windows = bits / W;
    const windowSize = this.windowSize = 2 ** W;
    const items = [];
    for (let w = 0; w < windows; w++) {
      for (let byte = 0; byte < windowSize; byte++) {
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
        for (let j = 0; j < W; j++) {
          const bit = byte >>> W - j - 1 & 1;
          if (!bit)
            continue;
          const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W * w + j];
          s0 ^= d0, s1 ^= d1, s2 ^= d2, s3 ^= d3;
        }
        items.push({ s0, s1, s2, s3 });
      }
    }
    this.t = items;
  }
  _updateBlock(s0, s1, s2, s3) {
    s0 ^= this.s0, s1 ^= this.s1, s2 ^= this.s2, s3 ^= this.s3;
    const { W, t, windowSize } = this;
    let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
    const mask = (1 << W) - 1;
    let w = 0;
    for (const num of [s0, s1, s2, s3]) {
      for (let bytePos = 0; bytePos < 4; bytePos++) {
        const byte = num >>> 8 * bytePos & 255;
        for (let bitPos = 8 / W - 1; bitPos >= 0; bitPos--) {
          const bit = byte >>> W * bitPos & mask;
          const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
          o0 ^= e0, o1 ^= e1, o2 ^= e2, o3 ^= e3;
          w += 1;
        }
      }
    }
    this.s0 = o0;
    this.s1 = o1;
    this.s2 = o2;
    this.s3 = o3;
  }
  update(data) {
    aexists(this);
    abytes(data);
    data = copyBytes(data);
    const b32 = u32(data);
    const blocks = Math.floor(data.length / BLOCK_SIZE);
    const left = data.length % BLOCK_SIZE;
    for (let i = 0; i < blocks; i++) {
      this._updateBlock(swap8IfBE(b32[i * 4 + 0]), swap8IfBE(b32[i * 4 + 1]), swap8IfBE(b32[i * 4 + 2]), swap8IfBE(b32[i * 4 + 3]));
    }
    if (left) {
      ZEROS16.set(data.subarray(blocks * BLOCK_SIZE));
      this._updateBlock(swap8IfBE(ZEROS32[0]), swap8IfBE(ZEROS32[1]), swap8IfBE(ZEROS32[2]), swap8IfBE(ZEROS32[3]));
      clean(ZEROS32);
    }
    return this;
  }
  destroy() {
    this.destroyed = true;
    const { t } = this;
    for (const elm of t) {
      elm.s0 = 0, elm.s1 = 0, elm.s2 = 0, elm.s3 = 0;
    }
  }
  digestInto(out) {
    aexists(this);
    aoutput32(out, this);
    this.finished = true;
    const { s0, s1, s2, s3 } = this;
    const o32 = u32(out);
    o32[0] = s0;
    o32[1] = s1;
    o32[2] = s2;
    o32[3] = s3;
    if (!isLE)
      swap32IfBE(o32.subarray(0, BLOCK_SIZE / 4));
  }
  digest() {
    const res = new Uint8Array(BLOCK_SIZE);
    this.digestInto(res);
    this.destroy();
    return res;
  }
};
var ghash = /* @__PURE__ */ wrapMacConstructor(16, (key, expectedLength) => new GHASH(key, expectedLength), (msg) => [msg.length]);

// node_modules/@noble/ciphers/aes.js
var BLOCK_SIZE2 = 16;
var BLOCK_SIZE32 = 4;
var EMPTY_BLOCK = /* @__PURE__ */ new Uint8Array(BLOCK_SIZE2);
var POLY2 = 283;
function validateKeyLength(key) {
  if (![16, 24, 32].includes(key.length))
    throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length=' + key.length);
}
function mul22(n) {
  return n << 1 ^ POLY2 & -(n >> 7);
}
function mul(a, b) {
  let res = 0;
  for (; b > 0; b >>= 1) {
    res ^= a & -(b & 1);
    a = mul22(a);
  }
  return res;
}
var sbox = /* @__PURE__ */ (() => {
  const t = new Uint8Array(256);
  for (let i = 0, x = 1; i < 256; i++, x ^= mul22(x))
    t[i] = x;
  const box = new Uint8Array(256);
  box[0] = 99;
  for (let i = 0; i < 255; i++) {
    let x = t[255 - i];
    x |= x << 8;
    box[t[i]] = (x ^ x >> 4 ^ x >> 5 ^ x >> 6 ^ x >> 7 ^ 99) & 255;
  }
  clean(t);
  return box;
})();
var rotr32_8 = (n) => n << 24 | n >>> 8;
var rotl32_8 = (n) => n << 8 | n >>> 24;
function genTtable(sbox2, fn) {
  if (sbox2.length !== 256)
    throw new Error("wrong sbox length");
  const T0 = new Uint32Array(256).map((_, j) => fn(sbox2[j]));
  const T1 = T0.map(rotl32_8);
  const T2 = T1.map(rotl32_8);
  const T3 = T2.map(rotl32_8);
  const T01 = new Uint32Array(256 * 256);
  const T23 = new Uint32Array(256 * 256);
  const sbox22 = new Uint16Array(256 * 256);
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const idx = i * 256 + j;
      T01[idx] = T0[i] ^ T1[j];
      T23[idx] = T2[i] ^ T3[j];
      sbox22[idx] = sbox2[i] << 8 | sbox2[j];
    }
  }
  return { sbox: sbox2, sbox2: sbox22, T0, T1, T2, T3, T01, T23 };
}
var tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => mul(s, 3) << 24 | s << 16 | s << 8 | mul(s, 2));
var xPowers = /* @__PURE__ */ (() => {
  const p = new Uint8Array(16);
  for (let i = 0, x = 1; i < 16; i++, x = mul22(x))
    p[i] = x;
  return p;
})();
function expandKeyLE(key) {
  abytes(key);
  const len = key.length;
  validateKeyLength(key);
  const { sbox2 } = tableEncoding;
  const toClean = [];
  if (!isLE || !isAligned32(key))
    toClean.push(key = copyBytes(key));
  const k32 = swap32IfBE(u32(key));
  const Nk = k32.length;
  const subByte = (n) => applySbox(sbox2, n, n, n, n);
  const xk = new Uint32Array(len + 28);
  xk.set(k32);
  for (let i = Nk; i < xk.length; i++) {
    let t = xk[i - 1];
    if (i % Nk === 0)
      t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
    else if (Nk > 6 && i % Nk === 4)
      t = subByte(t);
    xk[i] = xk[i - Nk] ^ t;
  }
  clean(...toClean);
  return xk;
}
function apply0123(T01, T23, s0, s1, s2, s3) {
  return T01[s0 << 8 & 65280 | s1 >>> 8 & 255] ^ T23[s2 >>> 8 & 65280 | s3 >>> 24 & 255];
}
function applySbox(sbox2, s0, s1, s2, s3) {
  return sbox2[s0 & 255 | s1 & 65280] | sbox2[s2 >>> 16 & 255 | s3 >>> 16 & 65280] << 16;
}
function encrypt(xk, s0, s1, s2, s3) {
  const { sbox2, T01, T23 } = tableEncoding;
  let k = 0;
  s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
  const rounds = xk.length / 4 - 2;
  for (let i = 0; i < rounds; i++) {
    const t02 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
    const t12 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
    const t22 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
    const t32 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
    s0 = t02, s1 = t12, s2 = t22, s3 = t32;
  }
  const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
  const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
  const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
  const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
  return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function ctr32(xk, isLE2, nonce, src, dst) {
  abytes(nonce, BLOCK_SIZE2, "nonce");
  abytes(src);
  dst = getOutput(src.length, dst);
  const ctr = nonce;
  const c32 = u32(ctr);
  const view = createView(ctr);
  const src32 = u32(src);
  const dst32 = u32(dst);
  const ctrPos = isLE2 ? 0 : 12;
  const srcLen = src.length;
  let ctrNum = view.getUint32(ctrPos, isLE2);
  for (let i = 0; i + 4 <= src32.length; i += 4) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    dst32[i + 0] = src32[i + 0] ^ swap8IfBE(s0);
    dst32[i + 1] = src32[i + 1] ^ swap8IfBE(s1);
    dst32[i + 2] = src32[i + 2] ^ swap8IfBE(s2);
    dst32[i + 3] = src32[i + 3] ^ swap8IfBE(s3);
    ctrNum = ctrNum + 1 >>> 0;
    view.setUint32(ctrPos, ctrNum, isLE2);
  }
  const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
  if (start < srcLen) {
    const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
    const b32 = new Uint32Array([s0, s1, s2, s3]);
    swap32IfBE(b32);
    const buf = u8(b32);
    for (let i = start, pos = 0; i < srcLen; i++, pos++)
      dst[i] = src[i] ^ buf[pos];
    clean(b32);
  }
  return dst;
}
function computeTag(fn, isLE2, key, data, AAD) {
  const aadLength = AAD ? AAD.length : 0;
  const h = fn.create(key, data.length + aadLength);
  if (AAD)
    h.update(AAD);
  const num = u64Lengths(8 * data.length, 8 * aadLength, isLE2);
  h.update(data);
  h.update(num);
  const res = h.digest();
  clean(num);
  return res;
}
var gcm = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, withAAD: true, varSizeNonce: true }, function aesgcm(key, nonce, AAD) {
  if (nonce.length < 8)
    throw new Error("aes/gcm: invalid nonce length");
  const tagLength = 16;
  function _computeTag(authKey, tagMask, data) {
    const tag = computeTag(ghash, false, authKey, data, AAD);
    for (let i = 0; i < tagMask.length; i++)
      tag[i] ^= tagMask[i];
    return tag;
  }
  function deriveKeys() {
    const xk = expandKeyLE(key);
    const authKey = EMPTY_BLOCK.slice();
    const counter = EMPTY_BLOCK.slice();
    ctr32(xk, false, counter, counter, authKey);
    if (nonce.length === 12) {
      counter.set(nonce);
    } else {
      const nonceLen = EMPTY_BLOCK.slice();
      const view = createView(nonceLen);
      view.setBigUint64(8, BigInt(nonce.length * 8), false);
      const g = ghash.create(authKey).update(nonce).update(nonceLen);
      g.digestInto(counter);
      g.destroy();
    }
    const tagMask = ctr32(xk, false, counter, EMPTY_BLOCK);
    return { xk, authKey, counter, tagMask };
  }
  return {
    encrypt(plaintext) {
      const { xk, authKey, counter, tagMask } = deriveKeys();
      const out = new Uint8Array(plaintext.length + tagLength);
      const toClean = [xk, authKey, counter, tagMask];
      if (!isAligned32(plaintext))
        toClean.push(plaintext = copyBytes(plaintext));
      ctr32(xk, false, counter, plaintext, out.subarray(0, plaintext.length));
      const tag = _computeTag(authKey, tagMask, out.subarray(0, out.length - tagLength));
      toClean.push(tag);
      out.set(tag, plaintext.length);
      clean(...toClean);
      return out;
    },
    decrypt(ciphertext) {
      const { xk, authKey, counter, tagMask } = deriveKeys();
      const toClean = [xk, authKey, tagMask, counter];
      if (!isAligned32(ciphertext))
        toClean.push(ciphertext = copyBytes(ciphertext));
      const data = ciphertext.subarray(0, -tagLength);
      const passedTag = ciphertext.subarray(-tagLength);
      const tag = _computeTag(authKey, tagMask, data);
      toClean.push(tag);
      if (!equalBytes(tag, passedTag)) {
        clean(...toClean);
        throw new Error("aes-gcm: invalid tag");
      }
      const out = ctr32(xk, false, counter, data);
      clean(...toClean);
      return out;
    }
  };
});

// node_modules/@noble/hashes/_u64.js
var fromNumH = (n) => n / 2 ** 32 | 0;
var fromNumL = (n) => n >>> 0;
function setU64FromNum(view, byteOffset, n, isLE2) {
  const h = fromNumH(n);
  const l = fromNumL(n);
  view.setUint32(byteOffset, isLE2 ? l : h, isLE2);
  view.setUint32(byteOffset + 4, isLE2 ? h : l, isLE2);
}

// node_modules/@noble/hashes/utils.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
var atitle2 = (title) => title ? `"${title}" ` : "";
function anumber2(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle2(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle2(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes2(value, length, title = "") {
  if (isBytes2(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber2(length, "length");
  const bytes = isBytes2(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle2(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes)
    throw new TypeError(message);
  throw new RangeError(message);
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new TypeError("expected hash wrapped by utils.createHasher");
  anumber2(h.outputLen);
  anumber2(h.blockLen);
  if (h.outputLen < 1 || h.blockLen < 1)
    throw new Error("hash blockLen / outputLen must be >= 1");
}
var aobject = (value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
};
var aopts = (value, label) => {
  aobject(value, label);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`"${label}" expected plain object`);
  if (Object.hasOwn(value, "__proto__"))
    throw new TypeError(`"${label}.__proto__" is not allowed`);
};
function aexists2(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput2(out, instance) {
  abytes2(out, void 0, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function clean2(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView2(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes2(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function asciiToBase16(ch) {
  return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  if (hasHexBuiltin) {
    try {
      return Uint8Array.fromHex(hex);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new RangeError(error.message);
      throw error;
    }
  }
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new RangeError("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function checkOpts(defaults, opts, title = "opts") {
  aopts(defaults, "defaults");
  if (opts !== void 0)
    aopts(opts, title);
  const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
  return merged;
}
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes(bytesLength = 32) {
  anumber2(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  if (bytesLength > 65536)
    throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var oidNist = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/hmac.js
var _HMAC = class {
  oHash;
  iHash;
  blockLen;
  outputLen;
  canXOF = false;
  finished = false;
  destroyed = false;
  constructor(hash, key) {
    ahash(hash);
    abytes2(key, void 0, "key");
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("expected Hash instance");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean2(pad);
  }
  update(buf) {
    aexists2(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists2(this);
    aoutput2(out, this);
    this.finished = true;
    const buf = out.subarray(0, this.outputLen);
    this.iHash.digestInto(buf);
    this.oHash.update(buf);
    this.oHash.digestInto(buf);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to ||= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen, canXOF } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.canXOF = canXOF;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac = /* @__PURE__ */ (() => {
  const hmac_ = ((hash, key, message) => new _HMAC(hash, key).update(message).digest());
  hmac_.create = (hash, key) => new _HMAC(hash, key);
  return hmac_;
})();

// node_modules/@noble/hashes/hkdf.js
function extract(hash, ikm, salt) {
  ahash(hash);
  if (salt === void 0)
    salt = new Uint8Array(hash.outputLen);
  return hmac(hash, salt, ikm);
}
var HKDF_COUNTER = /* @__PURE__ */ Uint8Array.of(0);
var EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
function expand(hash, prk, info, length = 32, _recycled) {
  ahash(hash);
  anumber2(length, "length");
  abytes2(prk, void 0, "prk");
  const olen = hash.outputLen;
  if (prk.length < olen)
    throw new Error('"prk" must be at least HashLen octets');
  if (length > 255 * olen)
    throw new Error("Length must be <= 255*HashLen");
  const blocks = Math.ceil(length / olen);
  if (info === void 0)
    info = EMPTY_BUFFER;
  else
    abytes2(info, void 0, "info");
  if (!blocks) {
    if (_recycled)
      clean2(prk);
    return new Uint8Array();
  }
  const okm = _recycled && blocks === 1 ? prk : new Uint8Array(blocks * olen);
  const { iHash, oHash } = hmac.create(hash, prk);
  const T = _recycled ? prk : new Uint8Array(olen);
  const worker = blocks > 1 ? _recycled?.iHash || hash.create() : void 0;
  for (let counter = 0; counter < blocks - 1; counter++) {
    HKDF_COUNTER[0] = counter + 1;
    const iWork = iHash._cloneInto(worker);
    if (counter)
      iWork.update(T);
    iWork.update(info).update(HKDF_COUNTER).digestInto(T);
    oHash._cloneInto(worker).update(T).digestInto(T);
    okm.set(T, olen * counter);
  }
  HKDF_COUNTER[0] = blocks;
  if (blocks > 1)
    iHash.update(T);
  iHash.update(info).update(HKDF_COUNTER).digestInto(T);
  oHash.update(T).digestInto(T);
  okm.set(T, olen * (blocks - 1));
  iHash.destroy();
  oHash.destroy();
  worker?.destroy();
  if (T !== okm)
    clean2(T);
  clean2(HKDF_COUNTER);
  if (length === okm.length)
    return okm;
  const res = okm.slice(0, length);
  clean2(okm);
  return res;
}

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE2) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView2(this.buffer);
  }
  update(data) {
    aexists2(this);
    abytes2(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    let processed = false;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView2(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        processed = true;
        continue;
      }
      buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
        processed = true;
      }
    }
    this.length += data.length;
    if (processed)
      this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists2(this);
    aoutput2(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    buffer.fill(0, pos);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      buffer.fill(0);
    }
    setU64FromNum(view, blockLen - 8, this.length * 8, isLE2);
    this.process(view, 0);
    this.roundClean();
    const oview = out === buffer ? view : createView2(out);
    const len = this.outputLen;
    const outLen = len / 4;
    const state = this.get();
    if (len % 4 || outLen > state.length)
      throw new Error("invalid outputLen");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneIntoMeta(to) {
    const { buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (pos)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  // Numeric initializers matter: starting the fields as `undefined` changes
  // V8's field representation and makes sha256 3x slower (measured).
  A = 0;
  B = 0;
  C = 0;
  D = 0;
  E = 0;
  F = 0;
  G = 0;
  H = 0;
  constructor(outputLen, IV) {
    super(64, outputLen, 8, false);
    this.A = IV[0] | 0;
    this.B = IV[1] | 0;
    this.C = IV[2] | 0;
    this.D = IV[3] | 0;
    this.E = IV[4] | 0;
    this.F = IV[5] | 0;
    this.G = IV[6] | 0;
    this.H = IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor()).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean2(SHA256_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean2(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  constructor() {
    super(32, SHA256_IV);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);

// node_modules/@noble/curves/utils.js
function aarray(item, title, inner = () => {
}) {
  if (!Array.isArray(item))
    throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
  for (let i = 0; i < item.length; i++)
    inner(item[i], `${title}[${i}]`);
  return item;
}
var abytes3 = (value, length, title) => abytes2(value, length, title);
var anumber3 = anumber2;
function aobject2(value, title = "object") {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
  return value;
}
function afunction(value, title) {
  if (typeof value !== "function")
    throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
  return value;
}
var bytesToHex2 = bytesToHex;
var hexToBytes2 = (hex) => hexToBytes(hex);
var isBytes3 = isBytes2;
var randomBytes2 = (bytesLength) => randomBytes(bytesLength);
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
var atitle3 = (title) => title ? `"${title}" ` : "";
function abool2(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle3(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new RangeError("positive bigint expected, got " + n);
  } else
    anumber3(n);
  return n;
}
function asafenumber(value, title = "") {
  if (typeof value !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected number, got type=" + typeof value);
  }
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new RangeError(prefix + "expected safe integer, got " + value);
  }
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  return hexToNumber(bytesToHex(copyBytes2(abytes2(bytes)).reverse()));
}
function numberToBytesBE(n, len) {
  anumber2(len);
  if (len === 0)
    throw new Error("zero output length is invalid");
  n = abignumber(n);
  const expectedLen = len * 2;
  const hex = n.toString(16);
  if (hex.length > expectedLen)
    throw new RangeError("number is too large");
  return hexToBytes(hex.padStart(expectedLen, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function copyBytes2(bytes) {
  return Uint8Array.from(abytes3(bytes));
}
function isPosBig(n) {
  return typeof n === "bigint" && _0n <= n;
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  if (n < _0n)
    throw new Error("expected non-negative bigint, got " + n);
  return n === _0n ? 0 : n.toString(2).length;
}
var bitMask = (n) => {
  asafenumber(n, "n");
  return (_1n << BigInt(n)) - _1n;
};
function validateObject(object, fields = {}, optFields = {}, title = "object") {
  aobject2(object, title);
  aobject2(fields, "fields");
  aobject2(optFields, "optFields");
  function checkField(fieldName, expectedType, isOpt) {
    const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
    const val = object[fieldName];
    if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== void 0 : expectedType !== "function")) {
      throw new TypeError(`${label} is invalid: expected own property`);
    }
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}

// node_modules/@noble/curves/abstract/modular.js
var _0n2 = /* @__PURE__ */ BigInt(0);
var _1n2 = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _15n = /* @__PURE__ */ BigInt(15);
var _16n = /* @__PURE__ */ BigInt(16);
var POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
function mod(a, b) {
  if (b <= _0n2)
    throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow(num, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow: expected modulus > 1, got " + modulo);
  if (typeof power !== "bigint")
    throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return _1n2;
  if (power === _1n2)
    return num;
  let d = num % modulo;
  if (d < _0n2)
    d += modulo;
  if (power < POW_WINDOWED_MIN) {
    let p2 = _1n2;
    while (power > _0n2) {
      if (power & _1n2)
        p2 = p2 * d % modulo;
      d = d * d % modulo;
      power >>= _1n2;
    }
    return p2;
  }
  const digits = [];
  while (power > _0n2) {
    digits.push(Number(power & _15n));
    power >>= _4n;
  }
  const table = new Array(16);
  table[0] = _1n2;
  table[1] = d;
  for (let i = 2; i < 16; i++)
    table[i] = table[i - 1] * d % modulo;
  let p = table[digits[digits.length - 1]];
  for (let w = digits.length - 2; w >= 0; w--) {
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    const digit = digits[w];
    if (digit !== 0)
      p = p * table[digit] % modulo;
  }
  return p;
}
function pow2(x, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow2: expected modulus > 1, got " + modulo);
  if (power < _0n2)
    throw new Error("pow2: expected non-negative exponent, got " + power);
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _1n2)
    throw new Error("invert: expected modulus > 1, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, u = _1n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    b = a, a = r, x = u, u = m;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  const F = Fp;
  if (!F.eql(F.sqr(root), n))
    throw new Error("Cannot find square root");
}
function aoddModulus(order, fnName) {
  if ((order & _1n2) === _0n2)
    throw new Error(fnName + ": expected odd modulus, got " + order);
}
function sqrt3mod4(Fp, n) {
  const F = Fp;
  const p1div4 = (F.ORDER + _1n2) / _4n;
  const root = F.pow(n, p1div4);
  assertIsSquare(F, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const F = Fp;
  const p5div8 = (F.ORDER - _5n) / _8n;
  const n2 = F.mul(n, _2n);
  const v = F.pow(n2, p5div8);
  const nv = F.mul(n, v);
  const i = F.mul(F.mul(nv, _2n), v);
  const root = F.mul(nv, F.sub(i, F.ONE));
  assertIsSquare(F, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return ((Fp, n) => {
    const F = Fp;
    let tv1 = F.pow(n, c4);
    let tv2 = F.mul(tv1, c1);
    const tv3 = F.mul(tv1, c2);
    const tv4 = F.mul(tv1, c3);
    const e1 = F.eql(F.sqr(tv2), n);
    const e2 = F.eql(F.sqr(tv3), n);
    tv1 = F.cmov(tv1, tv2, e1);
    tv2 = F.cmov(tv4, tv3, e2);
    const e3 = F.eql(F.sqr(tv2), n);
    const root = F.cmov(tv1, tv2, e3);
    assertIsSquare(F, root, n);
    return root;
  });
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  aoddModulus(P, "tonelliShanks");
  let Q = P - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return function tonelliSlow(Fp, n) {
    const F = Fp;
    if (F.is0(n))
      return n;
    if (FpLegendre(F, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = F.mul(F.ONE, cc);
    let t = F.pow(n, Q);
    let R = F.pow(n, Q1div2);
    while (!F.eql(t, F.ONE)) {
      if (F.is0(t))
        throw new Error("Cannot find square root: probably non-prime P");
      let i = 1;
      let t_tmp = F.sqr(t);
      while (!F.eql(t_tmp, F.ONE)) {
        i++;
        t_tmp = F.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = F.pow(c, exponent);
      M = i;
      c = F.sqr(b);
      t = F.mul(t, c);
      R = F.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  aoddModulus(P, "Fp.sqrt");
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
var isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n2) === _1n2;
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  aobject2(field, "field");
  if (typeof field.ORDER !== "bigint")
    throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
  asafenumber(field.BYTES, "BYTES");
  asafenumber(field.BITS, "BITS");
  for (const name of FIELD_FIELDS)
    afunction(field[name], "field." + name);
  if (field.BYTES < 1 || field.BITS < 1)
    throw new Error("invalid field: expected BYTES/BITS > 0");
  if (field.ORDER <= _1n2)
    throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  validateField(Fp);
  aarray(nums, "nums");
  abool2(passZero, "passZero");
  const F = Fp;
  const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (F.is0(num))
      return acc;
    inverted[i] = acc;
    return F.mul(acc, num);
  }, F.ONE);
  const invertedAcc = F.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (F.is0(num))
      return acc;
    inverted[i] = F.mul(acc, inverted[i]);
    return F.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  validateField(Fp);
  const F = Fp;
  aoddModulus(F.ORDER, "FpLegendre");
  const p1mod2 = (F.ORDER - _1n2) / _2n;
  const powered = F.pow(n, p1mod2);
  const yes = F.eql(powered, F.ONE);
  const zero = F.eql(powered, F.ZERO);
  const no = F.eql(powered, F.neg(F.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber3(nBitLength);
  if (n <= _0n2)
    throw new Error("invalid n length: expected positive n, got " + n);
  if (nBitLength !== void 0 && nBitLength < 1)
    throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
  const bits = bitLen(n);
  if (nBitLength !== void 0 && nBitLength < bits)
    throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
var FIELD_SQRT = /* @__PURE__ */ new WeakMap();
var _Field = class {
  ORDER;
  BITS;
  BYTES;
  isLE;
  ZERO = _0n2;
  ONE = _1n2;
  _lengths;
  _mod;
  constructor(ORDER, opts = {}) {
    if (ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
    let _nbitLength = void 0;
    this.isLE = false;
    if (opts != null && typeof opts === "object") {
      if (typeof opts.BITS === "number")
        _nbitLength = opts.BITS;
      if (typeof opts.sqrt === "function")
        Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
      if (typeof opts.isLE === "boolean")
        this.isLE = opts.isLE;
      if (opts.allowedLengths)
        this._lengths = Object.freeze(opts.allowedLengths.slice());
      if (typeof opts.modFromBytes === "boolean")
        this._mod = opts.modFromBytes;
    }
    const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
    if (nByteLength > 2048)
      throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    this.ORDER = ORDER;
    this.BITS = nBitLength;
    this.BYTES = nByteLength;
    Object.freeze(this);
  }
  create(num) {
    return mod(num, this.ORDER);
  }
  isValid(num) {
    if (typeof num !== "bigint")
      throw new TypeError("invalid field element: expected bigint, got " + typeof num);
    return _0n2 <= num && num < this.ORDER;
  }
  is0(num) {
    return num === _0n2;
  }
  // is valid and invertible
  isValidNot0(num) {
    return !this.is0(num) && this.isValid(num);
  }
  isOdd(num) {
    return (num & _1n2) === _1n2;
  }
  neg(num) {
    return mod(-num, this.ORDER);
  }
  eql(lhs, rhs) {
    return lhs === rhs;
  }
  sqr(num) {
    return mod(num * num, this.ORDER);
  }
  add(lhs, rhs) {
    return mod(lhs + rhs, this.ORDER);
  }
  sub(lhs, rhs) {
    return mod(lhs - rhs, this.ORDER);
  }
  mul(lhs, rhs) {
    return mod(lhs * rhs, this.ORDER);
  }
  pow(num, power) {
    return pow(num, power, this.ORDER);
  }
  div(lhs, rhs) {
    return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
  }
  // Same as above, but doesn't normalize
  sqrN(num) {
    return num * num;
  }
  addN(lhs, rhs) {
    return lhs + rhs;
  }
  subN(lhs, rhs) {
    return lhs - rhs;
  }
  mulN(lhs, rhs) {
    return lhs * rhs;
  }
  inv(num) {
    return invert(num, this.ORDER);
  }
  sqrt(num) {
    let sqrt = FIELD_SQRT.get(this);
    if (!sqrt)
      FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
    return sqrt(this, num);
  }
  toBytes(num) {
    return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
  }
  fromBytes(bytes, skipValidation = false) {
    abytes3(bytes);
    const { _lengths: allowedLengths, BYTES, isLE: isLE2, ORDER, _mod: modFromBytes } = this;
    if (allowedLengths) {
      if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
        throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
      }
      const padded = new Uint8Array(BYTES);
      padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
      bytes = padded;
    }
    if (bytes.length !== BYTES)
      throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
    let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    if (modFromBytes)
      scalar = mod(scalar, ORDER);
    if (!skipValidation) {
      if (!this.isValid(scalar))
        throw new Error("invalid field element: outside of range 0..ORDER");
    }
    return scalar;
  }
  // TODO: we don't need it here, move out to separate fn
  invertBatch(lst) {
    return FpInvertBatch(this, lst, true);
  }
  // We can't move this out because Fp6, Fp12 implement it
  // and it's unclear what to return in there.
  cmov(a, b, condition) {
    abool2(condition, "condition");
    return condition ? b : a;
  }
};
function Field(ORDER, opts = {}) {
  Object.freeze(_Field.prototype);
  return new _Field(ORDER, opts);
}

// node_modules/@noble/curves/abstract/curve.js
var _0n3 = /* @__PURE__ */ BigInt(0);
var _1n3 = /* @__PURE__ */ BigInt(1);
var _4n2 = /* @__PURE__ */ BigInt(4);
var BLIND_BYTES = 16;
var BLIND_BITS = 128;
var FW_WINDOW = 5;
var TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
function validatePointCons(Point) {
  const pc = Point;
  if (typeof pc !== "function")
    throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
  afunction(pc.fromAffine, "Point.fromAffine");
  afunction(pc.fromBytes, "Point.fromBytes");
  afunction(pc.fromHex, "Point.fromHex");
  aobject2(pc.BASE, "Point.BASE");
  aobject2(pc.ZERO, "Point.ZERO");
  validateField(pc.Fp);
  validateField(pc.Fn);
}
function normalizeZ(c, points) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits, min = 1) {
  if (!Number.isSafeInteger(W) || W < min || W > bits)
    throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
}
function validateTableBytes(numPoints, fpBytes) {
  const bytes = numPoints * (4 * fpBytes + 128);
  if (bytes > TABLE_BYTES_MAX)
    throw new Error("invalid window size: table would need ~" + Math.ceil(bytes / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
}
function probeRandomBytes(randomBytes3, length) {
  if (randomBytes3 === void 0)
    return void 0;
  afunction(randomBytes3, "randomBytes");
  try {
    const probe = randomBytes3(length);
    if (!isBytes3(probe) || probe.length !== length)
      return void 0;
  } catch {
    return void 0;
  }
  return randomBytes3;
}
function validateMSMPoints(points, c) {
  aarray(points, "points");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field, maxScalar) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    const ok = maxScalar === void 0 ? field.isValid(s) : isPosBig(s) && s < maxScalar;
    if (!ok)
      throw new Error("invalid scalar at index " + i);
  });
}
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getWindowSize(P) {
  return pointWindowSizes.get(P) || 1;
}
function oddMultiples(p, size) {
  const dbl = p.double();
  const t = [p];
  for (let j = 1; j < size; j++)
    t.push(t[j - 1].add(dbl));
  return t;
}
function wnafDigits(n, W) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const d = [];
  while (n > _0n3) {
    let w = 0;
    if (n & _1n3) {
      w = Number(n & mask);
      if (w >= half)
        w -= size;
      n -= BigInt(w);
    }
    d.push(w);
    n >>= _1n3;
  }
  return d;
}
function signedWindowDigits(n, W, windows) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const shiftBy = BigInt(W);
  const d = [];
  for (let w = 0; w < windows; w++) {
    let v = Number(n & mask);
    n >>= shiftBy;
    if (v > half) {
      v -= size;
      n += _1n3;
    }
    d.push(v);
  }
  if (n !== _0n3)
    throw new Error("invalid wnaf");
  return d;
}
function wnafWalk(zero, tables, digits) {
  let max = 0;
  for (const d of digits)
    max = Math.max(max, d.length);
  let acc = zero;
  for (let bit = max - 1; bit >= 0; bit--) {
    if (bit !== max - 1)
      acc = acc.double();
    for (let i = 0; i < digits.length; i++) {
      const w = digits[i][bit];
      if (w) {
        const item = tables[i][Math.abs(w) - 1 >> 1];
        acc = acc.add(w < 0 ? item.negate() : item);
      }
    }
  }
  return acc;
}
var ScalarMultiplier = class {
  Point;
  BASE;
  ZERO;
  randomBytes;
  wnafPrecomputes = /* @__PURE__ */ new WeakMap();
  baseCanBeBlinded;
  bits;
  // Parametrized with a given Point class (not individual point)
  constructor(Point, randomBytes3) {
    validatePointCons(Point);
    this.randomBytes = probeRandomBytes(randomBytes3, BLIND_BYTES);
    this.Point = Point;
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.bits = Point.Fn.BITS;
  }
  /**
   * Creates a signed fixed-window wNAF precomputation table: for every window w, the
   * multiples `[1..2^(W−1)]⋅2^(w⋅W)⋅P`, flattened. All doublings are baked into the table,
   * so cached multiplication is additions-only. `windows = ceil(bits/W) + 1`: the extra
   * window absorbs the final carry of signed-digit recoding.
   * For a 256-bit curve and W=6, the table is 44⋅32 = 1408 points.
   * @param point - Point instance
   * @param W - window size
   * @param bits - scalar bitlength the table must cover
   */
  buildWnafTable(point, W, bits) {
    const windows = Math.ceil(bits / W) + 1;
    const half = 2 ** (W - 1);
    const comp = [];
    let base = point;
    for (let w = 0; w < windows; w++) {
      let acc = base;
      for (let i = 0; i < half; i++) {
        comp.push(acc);
        acc = acc.add(base);
      }
      base = comp[comp.length - 1].double();
    }
    return { W, bits, windows, comp };
  }
  /**
   * Implements ec multiplication using precomputed signed fixed-window wNAF tables.
   * Constant-time: fixed window count with one table addition per window — zero digits feed
   * the fake accumulator — and no doublings; the lookup scans the whole window slice.
   * Scalar bounds are validated by the public entry points ({@link ScalarMultiplier.mulCT},
   * {@link ScalarMultiplier.mulCTBlinded}, {@link ScalarMultiplier.mulUnsafe});
   * signedWindowDigits throws if `n` exceeds the table.
   * @returns real and fake (for const-time) points
   */
  wnafCachedCT(precomputes, n) {
    const { W, windows, comp } = precomputes;
    const half = 2 ** (W - 1);
    const digits = signedWindowDigits(n, W, windows);
    let p = this.ZERO;
    let f = this.BASE;
    for (let w = 0; w < windows; w++) {
      const digit = digits[w];
      const start = w * half;
      const idx = Math.abs(digit) - 1;
      let sel = comp[start];
      for (let i = 1; i < half; i++)
        sel = i === idx ? comp[start + i] : sel;
      const neg = sel.negate();
      if (digit === 0)
        f = f.add(comp[start]);
      else
        p = p.add(digit < 0 ? neg : sel);
    }
    return { p, f };
  }
  // Cache key is point identity plus (W, bits); at most two entries exist per point (public-width
  // `Fn.BITS` and blinded `Fn.BITS + BLIND_BITS`). Callers must not reuse the same point with
  // incompatible `transform(...)` layouts and expect a separate cache entry.
  getWnafPrecomputes(W, point, bits, transform) {
    let entries = this.wnafPrecomputes.get(point);
    let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
    if (!comp) {
      comp = this.buildWnafTable(point, W, bits);
      if (typeof transform === "function")
        comp = { ...comp, comp: transform(comp.comp) };
      if (!entries) {
        entries = [];
        this.wnafPrecomputes.set(point, entries);
      }
      entries.push(comp);
    }
    return comp;
  }
  assertPoint(point) {
    if (!(point instanceof this.Point))
      throw new TypeError('"point" expected Point instance, got type=' + typeof point);
  }
  // Shared prologue of the constant-time entry points. Rejects scalar 0: in key/signature-style
  // callers a zero scalar means broken upstream plumbing, and concrete Points already reject it.
  // Uses inRange instead of Fn.isValidNot0: validateField() only certifies the arithmetic subset.
  validateMulInput(point, scalar) {
    this.assertPoint(point);
    if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
      throw new Error("invalid scalar");
  }
  // Constant-time dispatch shared by mulCT / mulCTBlinded. Un-precomputed points (W===1, e.g.
  // ECDH peer keys) skip building a throwaway cached table in favor of a small fixed-window
  // multiply. `n` must be < 2^bits.
  runCT(point, n, bits, transform) {
    const W = getWindowSize(point);
    if (W === 1)
      return this.fixedWindowCT(point, n, bits);
    return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
  }
  mulCT(point, scalar, transform) {
    this.validateMulInput(point, scalar);
    return this.runCT(point, scalar, this.bits, transform);
  }
  mulCTBlinded(point, scalar, transform) {
    this.validateMulInput(point, scalar);
    if (this.randomBytes === void 0)
      throw new Error("randomBytes is required for scalar blinding");
    const bits = this.Point.Fn.BITS + BLIND_BITS;
    const blind = this.randomBytes(BLIND_BYTES);
    if (!isBytes3(blind) || blind.length !== BLIND_BYTES)
      throw new Error("randomBytes returned invalid byte array");
    blind[0] = blind[0] & 63 | 128;
    const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
    return this.runCT(point, n, bits, transform);
  }
  /**
   * Constant-time multiplication `n*point` for an un-precomputed point, via a small fixed window.
   * A cached wNAF table only pays off when reused; a flat 2^FW_WINDOW table (`size-1` adds) is
   * far cheaper to build for a single use. The point-operation sequence is independent of `n`:
   * build the table, then per window exactly FW_WINDOW doublings, a data-oblivious scan over
   * every table entry, and one addition (adds the identity when the window digit is 0 — never
   * skipped).
   *
   * `n` must be `< 2^bits`. Assumes complete addition (adding the identity costs the same as any
   * add), which holds for the Weierstrass/Edwards point types used here. The table is left in
   * projective form (no normalizeZ): normalizing this small a table costs more than the
   * mixed-add savings it would buy for a single multiply.
   * @returns real point `p`; `f` duplicates it only to match {@link wnafCachedCT}'s return shape
   * (this path needs no fake accumulator — its op-count is already scalar-independent).
   */
  fixedWindowCT(point, n, bits) {
    const W = FW_WINDOW;
    const size = 1 << W;
    const mask = bitMask(W);
    const table = new Array(size);
    table[0] = this.ZERO;
    for (let i = 1; i < size; i++)
      table[i] = table[i - 1].add(point);
    const windows = Math.ceil(bits / W);
    let acc = this.ZERO;
    for (let window = windows - 1; window >= 0; window--) {
      if (window !== windows - 1)
        for (let d = 0; d < W; d++)
          acc = acc.double();
      const digit = Number(n >> BigInt(window * W) & mask);
      let sel = table[0];
      for (let i = 1; i < size; i++)
        sel = i === digit ? table[i] : sel;
      acc = acc.add(sel);
    }
    return { p: acc, f: acc };
  }
  shouldBlind(point, cofactor) {
    if (this.randomBytes === void 0)
      return false;
    if (cofactor === _1n3)
      return true;
    if (point !== this.BASE)
      return false;
    if (this.baseCanBeBlinded === void 0)
      this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
    return this.baseCanBeBlinded;
  }
  mulSecret(point, scalar, cofactor, transform) {
    return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
  }
  mulUnsafe(point, scalar, transform) {
    this.assertPoint(point);
    if (!isPosBig(scalar))
      throw new Error("invalid scalar");
    const W = getWindowSize(point);
    if (W === 1 || scalar >= this.Point.Fn.ORDER)
      return mulAddUnsafe(this.Point, [point], [scalar], true);
    const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
    return this.wnafCachedCT(precomputes, scalar).p;
  }
  // Remembers the window size used for precomputed wNAF multiplication of the given point
  // and drops any previously built tables. Usually only the base point is precomputed.
  // W=1 resets the point to the un-precomputed (table-less) paths.
  // W is additionally capped so tables stay under ~2 GiB ({@link TABLE_BYTES_MAX}).
  setWindowSize(point, W) {
    this.assertPoint(point);
    validateW(W, this.bits);
    const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
    validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
    pointWindowSizes.set(point, W);
    this.wnafPrecomputes.delete(point);
  }
  // True when a window size is set: tables themselves are built lazily on first multiply.
  hasWindowSize(point) {
    return getWindowSize(point) !== 1;
  }
};
function mulAddUnsafe(c, points, scalars, allowOversized = false) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  abool2(allowOversized, "allowOversized");
  validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
  if (points.length !== scalars.length)
    throw new Error("arrays of points and scalars must have equal length");
  const tables = points.map((p) => oddMultiples(p, 4));
  const digits = scalars.map((n) => wnafDigits(n, 4));
  return wnafWalk(c.ZERO, tables, digits);
}
function createField(order, field, isLE2) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE2 });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (type !== "weierstrass" && type !== "edwards")
    throw new Error('expected curve type "weierstrass" or "edwards"');
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  validateObject(curveOpts);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(isPosBig(val) && val !== _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
function createKeygen(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}

// node_modules/@noble/curves/abstract/edwards.js
var _0n4 = /* @__PURE__ */ BigInt(0);
var _1n4 = /* @__PURE__ */ BigInt(1);
var _2n2 = /* @__PURE__ */ BigInt(2);
var _4n3 = /* @__PURE__ */ BigInt(4);
var _8n2 = /* @__PURE__ */ BigInt(8);
function isEdValidXY(Fp, CURVE, x, y) {
  const x2 = Fp.sqr(x);
  const y2 = Fp.sqr(y);
  const left = Fp.add(Fp.mul(CURVE.a, x2), y2);
  const right = Fp.add(Fp.ONE, Fp.mul(CURVE.d, Fp.mul(x2, y2)));
  return Fp.eql(left, right);
}
function edwards(params, extraOpts = {}) {
  validateObject(extraOpts, {}, {}, "extraOpts");
  const opts = extraOpts;
  const validated = createCurveFields("edwards", params, opts, opts.FpFnLE);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor } = CURVE;
  if (FpLegendre(Fp, CURVE.a) !== 1)
    throw new Error("edwards: CURVE.a must be a square in Fp for complete addition formulas");
  if (FpLegendre(Fp, CURVE.d) !== -1)
    throw new Error("edwards: CURVE.d must be a non-square in Fp for complete addition formulas");
  validateObject(opts, {}, { uvRatio: "function", randomBytes: "function" });
  const randomBytes3 = opts.randomBytes === void 0 ? randomBytes2 : opts.randomBytes;
  const MASK = _2n2 << BigInt(Fp.BYTES * 8) - _1n4;
  function isOdd(n) {
    if (!Fp.isOdd)
      throw new Error("Field does not have .isOdd()");
    return Fp.isOdd(n);
  }
  const uvRatio2 = opts.uvRatio === void 0 ? (u, v) => {
    try {
      return { isValid: true, value: Fp.sqrt(Fp.div(u, v)) };
    } catch (e) {
      return { isValid: false, value: _0n4 };
    }
  } : opts.uvRatio;
  if (!isEdValidXY(Fp, CURVE, CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const mulA = Fp.eql(CURVE.a, Fp.neg(Fp.ONE)) ? (x) => Fp.neg(x) : Fp.eql(CURVE.a, Fp.ONE) ? (x) => x : (x) => Fp.mul(CURVE.a, x);
  function acoord(title, n, banZero = false) {
    const min = banZero ? _1n4 : _0n4;
    aInRange("coordinate " + title, n, min, MASK);
    return n;
  }
  function aedpoint(other) {
    if (!(other instanceof Point))
      throw new Error("EdwardsPoint expected");
  }
  class Point {
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE, Fp.mul(CURVE.Gx, CURVE.Gy));
    static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ONE, Fp.ZERO);
    static Fp = Fp;
    static Fn = Fn;
    X;
    Y;
    Z;
    T;
    constructor(X, Y, Z, T) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y);
      this.Z = acoord("z", Z, true);
      this.T = acoord("t", T);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /**
     * Create one extended Edwards point from affine coordinates.
     * Does NOT validate that the point is on-curve or torsion-free.
     * Use `.assertValidity()` on adversarial inputs.
     */
    static fromAffine(p) {
      if (p instanceof Point)
        throw new Error("extended point not allowed");
      const { x, y } = p || {};
      acoord("x", x);
      acoord("y", y);
      return new Point(x, y, Fp.ONE, Fp.mul(x, y));
    }
    // Uses algo from RFC8032 5.1.3.
    static fromBytes(bytes, zip215 = false) {
      const len = Fp.BYTES;
      const { a, d } = CURVE;
      bytes = copyBytes2(abytes3(bytes, len, "point"));
      abool2(zip215, "zip215");
      const normed = copyBytes2(bytes);
      const lastByte = bytes[len - 1];
      normed[len - 1] = lastByte & ~128;
      const y = bytesToNumberLE(normed);
      const max = zip215 ? MASK : Fp.ORDER;
      aInRange("point.y", y, _0n4, max);
      const y2 = Fp.sqr(y);
      const u = Fp.sub(y2, Fp.ONE);
      const v = Fp.sub(Fp.mulN(d, y2), a);
      let { isValid, value: x } = uvRatio2(u, v);
      if (!isValid)
        throw new Error("bad point: invalid y coordinate");
      const isXOdd = isOdd(x);
      const isLastByteOdd = (lastByte & 128) !== 0;
      if (!zip215 && Fp.is0(x) && isLastByteOdd)
        throw new Error("bad point: x=0 and x_0=1");
      if (isLastByteOdd !== isXOdd)
        x = Fp.neg(x);
      return Point.fromAffine({ x, y });
    }
    static fromHex(hex, zip215 = false) {
      return Point.fromBytes(hexToBytes2(hex), zip215);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 6, isLazy = true) {
      wnaf.setWindowSize(this, windowSize);
      if (!isLazy)
        this.multiply(_2n2);
      return this;
    }
    // Useful in fromAffine() - not for fromBytes(), which always created valid points.
    assertValidity() {
      const p = this;
      const { a, d } = CURVE;
      if (p.is0())
        throw new Error("bad point: ZERO");
      const { X, Y, Z, T } = p;
      const X2 = Fp.sqr(X);
      const Y2 = Fp.sqr(Y);
      const Z2 = Fp.sqr(Z);
      const Z4 = Fp.sqr(Z2);
      const aX2 = Fp.mul(X2, a);
      const left = Fp.mul(Fp.add(aX2, Y2), Z2);
      const right = Fp.add(Z4, Fp.mul(d, Fp.mul(X2, Y2)));
      if (!Fp.eql(left, right))
        throw new Error("bad point: equation left != right (1)");
      const XY = Fp.mul(X, Y);
      const ZT = Fp.mul(Z, T);
      if (!Fp.eql(XY, ZT))
        throw new Error("bad point: equation left != right (2)");
    }
    // Compare one point to another.
    equals(other) {
      aedpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const X1Z2 = Fp.mul(X1, Z2);
      const X2Z1 = Fp.mul(X2, Z1);
      const Y1Z2 = Fp.mul(Y1, Z2);
      const Y2Z1 = Fp.mul(Y2, Z1);
      return Fp.eql(X1Z2, X2Z1) && Fp.eql(Y1Z2, Y2Z1);
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    negate() {
      return new Point(Fp.neg(this.X), this.Y, this.Z, Fp.neg(this.T));
    }
    // Fast algo for doubling Extended Point.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
    // Cost: 4M + 4S + 1*a + 6add + 1*2.
    double() {
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const A = Fp.sqr(X1);
      const B = Fp.sqr(Y1);
      const C = Fp.mul(Fp.sqr(Z1), _2n2);
      const D = mulA(A);
      const x1y1 = Fp.addN(X1, Y1);
      const E = Fp.sub(Fp.subN(Fp.sqr(x1y1), A), B);
      const G = Fp.addN(D, B);
      const F = Fp.subN(G, C);
      const H = Fp.subN(D, B);
      const X3 = Fp.mul(E, F);
      const Y3 = Fp.mul(G, H);
      const T3 = Fp.mul(E, H);
      const Z3 = Fp.mul(F, G);
      return new Point(X3, Y3, Z3, T3);
    }
    // Fast algo for adding 2 Extended Points.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
    // Cost: 9M + 1*a + 1*d + 7add.
    add(other) {
      aedpoint(other);
      const { d } = CURVE;
      const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
      const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
      const A = Fp.mul(X1, X2);
      const B = Fp.mul(Y1, Y2);
      const C = Fp.mul(Fp.mulN(T1, d), T2);
      const D = Fp.mul(Z1, Z2);
      const E = Fp.sub(Fp.subN(Fp.mulN(Fp.addN(X1, Y1), Fp.addN(X2, Y2)), A), B);
      const F = Fp.subN(D, C);
      const G = Fp.addN(D, C);
      const H = Fp.sub(B, mulA(A));
      const X3 = Fp.mul(E, F);
      const Y3 = Fp.mul(G, H);
      const T3 = Fp.mul(E, H);
      const Z3 = Fp.mul(F, G);
      return new Point(X3, Y3, Z3, T3);
    }
    subtract(other) {
      aedpoint(other);
      return this.add(other.negate());
    }
    // Constant-time multiplication.
    multiply(scalar) {
      if (!Fn.isValidNot0(scalar))
        throw new RangeError("invalid scalar: expected 1 <= sc < curve.n");
      const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize3);
      return normalize3([p, f])[0];
    }
    // Non-constant-time multiplication. Uses double-and-add algorithm.
    // It's faster, but should only be used when you don't care about
    // an exposed private key e.g. sig verification.
    // Keeps the same subgroup-scalar contract: 0 is allowed for public-scalar callers, but
    // n and larger values are rejected instead of being reduced mod n to the identity point.
    multiplyUnsafe(scalar) {
      if (!Fn.isValid(scalar))
        throw new RangeError("invalid scalar: expected 0 <= sc < curve.n");
      if (scalar === _0n4)
        return Point.ZERO;
      if (this.is0() || scalar === _1n4)
        return this;
      return wnaf.mulUnsafe(this, scalar, normalize3);
    }
    // Checks if point is of small order.
    // If you add something to small order point, you will have "dirty"
    // point with torsion component.
    // Clears cofactor and checks if the result is 0.
    isSmallOrder() {
      return this.clearCofactor().is0();
    }
    // Multiplies point by curve order and checks if the result is 0.
    // Returns `false` is the point is dirty.
    isTorsionFree() {
      return wnaf.mulUnsafe(this, CURVE.n).is0();
    }
    // Converts Extended point to default (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      if (iz != null && typeof iz !== "bigint")
        throw new TypeError('"invertedZ" expected bigint, got type=' + typeof iz);
      const { X, Y, Z } = p;
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp.create(_8n2) : Fp.inv(Z);
      const x = Fp.mul(X, iz);
      const y = Fp.mul(Y, iz);
      const zz = Fp.mul(Z, iz);
      if (is0)
        return { x: Fp.ZERO, y: Fp.ONE };
      if (!Fp.eql(zz, Fp.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    clearCofactor() {
      if (cofactor === _1n4)
        return this;
      if (cofactor === _2n2)
        return this.double();
      if (cofactor === _4n3)
        return this.double().double();
      if (cofactor === _8n2)
        return this.double().double().double();
      return this.multiplyUnsafe(cofactor);
    }
    toBytes() {
      const { x, y } = this.toAffine();
      const bytes = Fp.toBytes(y);
      bytes[bytes.length - 1] |= isOdd(x) ? 128 : 0;
      return bytes;
    }
    toHex() {
      return bytesToHex2(this.toBytes());
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const normalize3 = (points) => normalizeZ(Point, points);
  const wnaf = new ScalarMultiplier(Point, randomBytes3);
  if (wnaf.bits >= 6)
    Point.BASE.precompute(6);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}

// node_modules/@noble/curves/abstract/montgomery.js
var _0n5 = /* @__PURE__ */ BigInt(0);
var _1n5 = /* @__PURE__ */ BigInt(1);
var _2n3 = /* @__PURE__ */ BigInt(2);
function cmask(P, swap) {
  return P + swap - (swap >> _1n5 << _1n5);
}
function cswap(P) {
  const offset = BigInt(6) * P;
  return (mask, x_2, x_3) => {
    const sum = x_2 + x_3;
    const d = offset + x_3 - x_2;
    const a = (d * mask + x_2) % P;
    return { x_2: a, x_3: sum - a };
  };
}
function validateOpts(curve) {
  validateObject(curve, {
    P: "bigint",
    type: "string",
    adjustScalarBytes: "function",
    powPminus2: "function"
  }, {
    randomBytes: "function",
    scalarMultBase: "function"
  });
  return Object.freeze({ ...curve });
}
function montgomery(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { P, type, adjustScalarBytes: adjustScalarBytes2, powPminus2, randomBytes: rand } = CURVE;
  const mulBaseHook = CURVE.scalarMultBase;
  const is25519 = type === "x25519";
  if (!is25519 && type !== "x448")
    throw new Error("invalid type");
  const randomBytes_ = rand === void 0 ? randomBytes2 : rand;
  const montgomeryBits = is25519 ? 255 : 448;
  const swap = cswap(P);
  const fieldLen = is25519 ? 32 : 56;
  const Gu = is25519 ? BigInt(9) : BigInt(5);
  const a24 = is25519 ? BigInt(121665) : BigInt(39081);
  const minScalar = is25519 ? _2n3 ** BigInt(254) : _2n3 ** BigInt(447);
  const maxAdded = is25519 ? BigInt(8) * (_2n3 ** BigInt(251) - _1n5) : BigInt(4) * (_2n3 ** BigInt(445) - _1n5);
  const maxScalar = minScalar + maxAdded + _1n5;
  const modP = (n) => mod(n, P);
  const GuBytes = encodeU(Gu);
  function encodeU(u) {
    return numberToBytesLE(modP(u), fieldLen);
  }
  function decodeU(u) {
    const _u = copyBytes2(abytes3(u, fieldLen, "uCoordinate"));
    if (is25519)
      _u[31] &= 127;
    return modP(bytesToNumberLE(_u));
  }
  function decodeScalar(scalar) {
    return bytesToNumberLE(adjustScalarBytes2(copyBytes2(abytes3(scalar, fieldLen, "scalar"))));
  }
  const lowOrderU = new Set(is25519 ? [
    _0n5,
    _1n5,
    P - _1n5,
    BigInt("325606250916557431795983626356110631294008115727848805560023387167927233504"),
    BigInt("39382357235489614581723060781553021112529911719440698176882885853963445705823")
  ] : [_0n5, _1n5, P - _1n5]);
  function scalarMult(scalar, u) {
    const pointU = decodeU(u);
    if (lowOrderU.has(pointU))
      throw new Error("invalid private or public key received");
    const pu = montgomeryLadder(pointU, decodeScalar(scalar));
    if (pu === _0n5)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  function scalarMultBase(scalar) {
    if (mulBaseHook === void 0)
      return scalarMult(scalar, GuBytes);
    const k = decodeScalar(scalar);
    aInRange("scalar", k, minScalar, maxScalar);
    const pu = modP(mulBaseHook(k));
    if (pu === _0n5)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  const getPublicKey = scalarMultBase;
  const getSharedSecret = scalarMult;
  function montgomeryLadder(u, scalar) {
    aInRange("u", u, _0n5, P);
    aInRange("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = _1n5;
    let z_2 = _0n5;
    let x_3 = u;
    let z_3 = _1n5;
    const kx = k ^ k >> _1n5;
    for (let t = BigInt(montgomeryBits - 1); t >= _0n5; t--) {
      const mask2 = cmask(P, kx >> t);
      ({ x_2, x_3 } = swap(mask2, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = swap(mask2, z_2, z_3));
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B = x_2 - z_2;
      const BB = modP(B * B);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D = x_3 - z_3;
      const DA = modP(D * A);
      const CB = modP(C * B);
      const dacb = DA + CB;
      const da_cb = DA - CB;
      x_3 = modP(dacb * dacb);
      z_3 = modP(x_1 * modP(da_cb * da_cb));
      x_2 = modP(AA * BB);
      z_2 = modP(E * (AA + modP(a24 * E)));
    }
    const mask = cmask(P, k);
    ({ x_2, x_3 } = swap(mask, x_2, x_3));
    ({ x_2: z_2, x_3: z_3 } = swap(mask, z_2, z_3));
    const z2 = powPminus2(z_2);
    return modP(x_2 * z2);
  }
  const lengths = {
    secretKey: fieldLen,
    publicKey: fieldLen,
    seed: fieldLen
  };
  const randomSecretKey = (seed) => {
    seed = seed === void 0 ? randomBytes_(fieldLen) : seed;
    abytes3(seed, lengths.seed, "seed");
    return seed;
  };
  const utils = { randomSecretKey };
  Object.freeze(lengths);
  Object.freeze(utils);
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getSharedSecret,
    getPublicKey,
    scalarMult,
    scalarMultBase,
    utils,
    GuBytes: GuBytes.slice(),
    lengths
  });
}

// node_modules/@noble/curves/ed25519.js
var _0n6 = /* @__PURE__ */ BigInt(0);
var _1n6 = /* @__PURE__ */ BigInt(1);
var _2n4 = /* @__PURE__ */ BigInt(2);
var _3n2 = /* @__PURE__ */ BigInt(3);
var _5n2 = /* @__PURE__ */ BigInt(5);
var _8n3 = /* @__PURE__ */ BigInt(8);
var ed25519_CURVE_p = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
var ed25519_CURVE = /* @__PURE__ */ (() => ({
  p: ed25519_CURVE_p,
  n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
  h: _8n3,
  a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
  d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
  Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
  Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
}))();
function ed25519_pow_2_252_3(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, _2n4, P) * b2 % P;
  const b5 = pow2(b4, _1n6, P) * x % P;
  const b10 = pow2(b5, _5n2, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n4, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
var ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
function uvRatio(u, v) {
  const P = ed25519_CURVE_p;
  const v3 = mod(v * v * v, P);
  const v7 = mod(v3 * v3 * v, P);
  const pow3 = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
  let x = mod(u * v3 * pow3, P);
  const vx2 = mod(v * x * x, P);
  const root1 = x;
  const root2 = mod(x * ED25519_SQRT_M1, P);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === mod(-u, P);
  const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if (isNegativeLE(x, P))
    x = mod(-x, P);
  return { isValid: useRoot1 || useRoot2, value: x };
}
var ed25519_Point = /* @__PURE__ */ edwards(ed25519_CURVE, { uvRatio });
var x25519 = /* @__PURE__ */ (() => {
  const P = ed25519_CURVE_p;
  const powPminus2 = (x) => {
    const { pow_p_5_8, b2 } = ed25519_pow_2_252_3(x);
    return mod(pow2(pow_p_5_8, _3n2, P) * b2, P);
  };
  return montgomery({
    P,
    type: "x25519",
    powPminus2,
    adjustScalarBytes,
    // ~3x faster fixed-base: [k]B on the birationally-equivalent Edwards curve using cached
    // base tables, mapped back via u = (1+y)/(1-y) = (Z+Y)/(Z-Y) with one Fermat inversion.
    // Same construction as libsodium's crypto_scalarmult_curve25519_base.
    scalarMultBase: (k) => {
      const kn = mod(k, ed25519_Point.Fn.ORDER);
      if (kn === _0n6)
        return _0n6;
      const p = ed25519_Point.BASE.multiply(kn);
      return mod((p.Z + p.Y) * powPminus2(mod(p.Z - p.Y, P)), P);
    }
  });
})();

// node_modules/@panva/hpke-noble/index.js
var AES_GCM_P_MAX2 = 2 ** 36 - 31;
var CHACHA20_POLY1305_P_MAX2 = 2 ** 38 - 64;
var AEAD_AES_256_GCM = () => createAead(2, "AES-256-GCM", 32, AES_GCM_P_MAX2, gcm);
function createAead(id, name, Nk, P_MAX, cipher) {
  return {
    id,
    type: "AEAD",
    name,
    Nk,
    Nn: 12,
    Nt: 16,
    async Seal(key, nonce, aad, pt) {
      if (pt.byteLength > P_MAX) {
        throw new RangeError('"pt" exceeds P_MAX');
      }
      return cipher(key, nonce, aad).encrypt(pt);
    },
    async Open(key, nonce, aad, ct) {
      return cipher(key, nonce, aad).decrypt(ct);
    }
  };
}
var KDF_HKDF_SHA256 = () => createTwoStageKdf(1, "HKDF-SHA256", 32, sha256);
function createTwoStageKdf(id, name, Nh, hash) {
  return {
    id,
    type: "KDF",
    name,
    Nh,
    stages: 2,
    async Extract(salt, ikm) {
      return extract(hash, ikm, salt);
    },
    async Expand(prk, info, L) {
      return expand(hash, prk, info, L);
    },
    Derive: Unreachable
  };
}
var Unreachable = () => {
  throw new Error("unreachable");
};
var KEM_DHKEM_X25519_HKDF_SHA256 = () => createDhKemX({
  id: 32,
  name: "DHKEM(X25519, HKDF-SHA256)",
  Nsecret: 32,
  Nenc: 32,
  Npk: 32,
  Nsk: 32,
  curve: x25519,
  kdf: KDF_HKDF_SHA256
});
async function deriveSharedSecret(kdf2, suite_id, Nsecret, dh, enc, pkRm) {
  const kem_context = concat(enc, pkRm);
  const eae_prk = await LabeledExtract(kdf2, suite_id, new Uint8Array(), encode("eae_prk"), dh);
  return LabeledExpand(kdf2, suite_id, eae_prk, encode("shared_secret"), kem_context, Nsecret);
}
function createDhKemX(config) {
  const { id, name, Nsecret, Nenc, Npk, Nsk, curve, kdf: kdfFactory } = config;
  const kdf2 = kdfFactory();
  const suite_id = concat(encode("KEM"), I2OSP(id, 2));
  const algorithm = { name };
  Object.freeze(NobleKey.prototype);
  return {
    id,
    type: "KEM",
    name,
    Nsecret,
    Nenc,
    Npk,
    Nsk,
    async DeriveKeyPair(ikm, extractable) {
      const dkp_prk = await LabeledExtract(kdf2, suite_id, new Uint8Array(), encode("dkp_prk"), ikm);
      const sk = await LabeledExpand(kdf2, suite_id, dkp_prk, encode("sk"), new Uint8Array(), Nsk);
      const pk = curve.getPublicKey(sk);
      return {
        privateKey: new NobleKey(priv, "private", sk, extractable, algorithm),
        publicKey: new NobleKey(priv, "public", pk, true, algorithm)
      };
    },
    async GenerateKeyPair(extractable) {
      const ikm = crypto.getRandomValues(new Uint8Array(Nsk));
      return await this.DeriveKeyPair(ikm, extractable);
    },
    async SerializePublicKey(key) {
      NobleKey.validate(key, algorithm, true);
      return key.value(priv);
    },
    async DeserializePublicKey(key) {
      return new NobleKey(priv, "public", slice2(key), true, algorithm);
    },
    async SerializePrivateKey(key) {
      NobleKey.validate(key, algorithm, true);
      return key.value(priv);
    },
    async DeserializePrivateKey(key, extractable) {
      return new NobleKey(priv, "private", slice2(key), extractable, algorithm);
    },
    async Encap(pkR) {
      NobleKey.validate(pkR, algorithm);
      const ekp = await this.GenerateKeyPair(false);
      const enc = ekp.publicKey.value(priv);
      const dh = curve.getSharedSecret(
        ekp.privateKey.value(priv),
        pkR.value(priv)
      );
      return {
        shared_secret: await deriveSharedSecret(
          kdf2,
          suite_id,
          Nsecret,
          dh,
          enc,
          pkR.value(priv)
        ),
        enc
      };
    },
    async Decap(enc, skR, pkR) {
      NobleKey.validate(skR, algorithm);
      const skRValue = skR.value(priv);
      pkR ??= await this.DeserializePublicKey(curve.getPublicKey(skRValue));
      NobleKey.validate(pkR, algorithm);
      const pkE = await this.DeserializePublicKey(enc);
      const dh = curve.getSharedSecret(skRValue, pkE.value(priv));
      return await deriveSharedSecret(
        kdf2,
        suite_id,
        Nsecret,
        dh,
        enc,
        pkR.value(priv)
      );
    }
  };
}
var InvalidInvocation = (_) => {
  if (_ !== priv) {
    throw new Error("invalid invocation");
  }
};
var priv = /* @__PURE__ */ Symbol();
var NobleKey = class _NobleKey {
  #type;
  #extractable;
  #algorithm;
  #value;
  #seed;
  static #isValid(key) {
    return key.#algorithm !== void 0;
  }
  static validate(key, algorithm, extractable) {
    if (key.algorithm?.name !== algorithm.name) {
      throw new TypeError(`key algorithm must be ${algorithm.name}`);
    }
    try {
      if (!_NobleKey.#isValid(key)) {
        throw new TypeError("unexpected key constructor");
      }
    } catch {
      throw new TypeError("unexpected key constructor");
    }
    if (extractable && !key.extractable) {
      throw new TypeError("key must be extractable");
    }
  }
  constructor(_, type, value, extractable, algorithm, seed) {
    InvalidInvocation(_);
    this.#type = type;
    this.#value = value;
    this.#extractable = extractable;
    this.#algorithm = algorithm;
    this.#seed = seed;
  }
  get algorithm() {
    return { name: this.#algorithm.name };
  }
  get extractable() {
    return this.#extractable;
  }
  get type() {
    return this.#type;
  }
  value(_) {
    InvalidInvocation(_);
    return slice2(this.#value);
  }
  seed(_) {
    InvalidInvocation(_);
    return slice2(this.#seed);
  }
};
function slice2(buffer, start, end) {
  return Uint8Array.prototype.slice.call(buffer, start, end);
}

// node_modules/ehbp/dist/esm/protocol.js
var PROTOCOL = {
  ENCAPSULATED_KEY_HEADER: "Ehbp-Encapsulated-Key",
  RESPONSE_NONCE_HEADER: "Ehbp-Response-Nonce",
  KEYS_MEDIA_TYPE: "application/ohttp-keys",
  KEYS_PATH: "/.well-known/hpke-keys",
  PROBLEM_JSON_MEDIA_TYPE: "application/problem+json",
  KEY_CONFIG_PROBLEM_TYPE: "urn:ietf:params:ehbp:error:key-config"
};
var HPKE_CONFIG = {
  KEM: 32,
  // X25519 HKDF SHA256
  KDF: 1,
  // HKDF SHA256
  AEAD: 2
  // AES-256-GCM
};

// node_modules/ehbp/dist/esm/derive.js
var kdf = KDF_HKDF_SHA256();
var aead = AEAD_AES_256_GCM();
var HPKE_REQUEST_INFO = "ehbp request";
var EXPORT_LABEL = "ehbp response";
var EXPORT_LENGTH = 32;
var RESPONSE_NONCE_LENGTH = 32;
var AES256_KEY_LENGTH = 32;
var AES_GCM_NONCE_LENGTH = 12;
var REQUEST_ENC_LENGTH = 32;
var RESPONSE_KEY_LABEL = new TextEncoder().encode("key");
var RESPONSE_NONCE_LABEL = new TextEncoder().encode("nonce");
async function deriveResponseKeys(exportedSecret, requestEnc, responseNonce) {
  if (exportedSecret.length !== EXPORT_LENGTH) {
    throw new Error(`exported secret must be ${EXPORT_LENGTH} bytes, got ${exportedSecret.length}`);
  }
  if (requestEnc.length !== REQUEST_ENC_LENGTH) {
    throw new Error(`request enc must be ${REQUEST_ENC_LENGTH} bytes, got ${requestEnc.length}`);
  }
  if (responseNonce.length !== RESPONSE_NONCE_LENGTH) {
    throw new Error(`response nonce must be ${RESPONSE_NONCE_LENGTH} bytes, got ${responseNonce.length}`);
  }
  const salt = new Uint8Array(requestEnc.length + responseNonce.length);
  salt.set(requestEnc, 0);
  salt.set(responseNonce, requestEnc.length);
  const prk = await kdf.Extract(salt, exportedSecret);
  const keyBytes = await kdf.Expand(prk, RESPONSE_KEY_LABEL, AES256_KEY_LENGTH);
  const nonceBase = await kdf.Expand(prk, RESPONSE_NONCE_LABEL, AES_GCM_NONCE_LENGTH);
  return { keyBytes, nonceBase };
}
function computeNonce(nonceBase, seq) {
  if (nonceBase.length !== AES_GCM_NONCE_LENGTH) {
    throw new Error(`nonce base must be ${AES_GCM_NONCE_LENGTH} bytes`);
  }
  if (!Number.isInteger(seq) || seq < 0 || seq >= 4294967296) {
    throw new Error(`sequence number must be an integer in range [0, 2^32): got ${seq}`);
  }
  const nonce = new Uint8Array(AES_GCM_NONCE_LENGTH);
  nonce.set(nonceBase);
  for (let i = 0; i < 8; i++) {
    const shift = i * 8;
    if (shift < 32) {
      nonce[AES_GCM_NONCE_LENGTH - 1 - i] ^= seq >>> shift & 255;
    }
  }
  return nonce;
}
async function decryptChunk(km, seq, ciphertext) {
  const nonce = computeNonce(km.nonceBase, seq);
  const plaintext = await aead.Open(km.keyBytes, nonce, new Uint8Array(0), ciphertext);
  return plaintext;
}
function hexToBytes3(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex character");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
function bytesToHex3(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// node_modules/ehbp/dist/esm/errors.js
var EhbpError = class extends Error {
  constructor(message, options) {
    super(message);
    this.name = "EhbpError";
    if (options?.cause)
      this.cause = options.cause;
  }
};
var KeyConfigMismatchError = class extends EhbpError {
  title;
  constructor(title) {
    super(title || "Server key configuration mismatch");
    this.name = "KeyConfigMismatchError";
    this.title = title || "";
  }
};
var ProtocolError = class extends EhbpError {
  constructor(message, options) {
    super(message, options);
    this.name = "ProtocolError";
  }
};
var DecryptionError = class extends EhbpError {
  constructor(message, options) {
    super(message, options);
    this.name = "DecryptionError";
  }
};

// node_modules/ehbp/dist/esm/request-options.js
var FORWARDED_INIT_KEYS = [
  "cache",
  "credentials",
  "integrity",
  "keepalive",
  "mode",
  "redirect",
  "referrer",
  "referrerPolicy",
  "signal"
];
function forwardedRequestInit(source) {
  const forwarded = {};
  if (!source) {
    return forwarded;
  }
  const record = source;
  const target = forwarded;
  for (const key of FORWARDED_INIT_KEYS) {
    const value = record[key];
    if (value !== void 0) {
      target[key] = value;
    }
  }
  if (forwarded.mode === "navigate") {
    delete forwarded.mode;
  }
  return forwarded;
}

// node_modules/ehbp/dist/esm/identity.js
function createSuite() {
  return new CipherSuite(KEM_DHKEM_X25519_HKDF_SHA256, KDF_HKDF_SHA256, AEAD_AES_256_GCM);
}
var Identity = class _Identity {
  suite;
  publicKey;
  privateKey;
  constructor(suite, publicKey, privateKey) {
    this.suite = suite;
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }
  /**
   * Generate a new identity with X25519 key pair
   */
  static async generate() {
    const suite = createSuite();
    const { publicKey, privateKey } = await suite.GenerateKeyPair(true);
    return new _Identity(suite, publicKey, privateKey);
  }
  /**
   * Create identity from JSON string
   */
  static async fromJSON(json2) {
    const data = JSON.parse(json2);
    const suite = createSuite();
    const publicKey = await suite.DeserializePublicKey(new Uint8Array(data.publicKey));
    const privateKey = await suite.DeserializePrivateKey(new Uint8Array(data.privateKey), true);
    return new _Identity(suite, publicKey, privateKey);
  }
  /**
   * Convert identity to JSON string
   */
  async toJSON() {
    const publicKeyBytes = await this.suite.SerializePublicKey(this.publicKey);
    const privateKeyBytes = await this.suite.SerializePrivateKey(this.privateKey);
    return JSON.stringify({
      publicKey: Array.from(publicKeyBytes),
      privateKey: Array.from(privateKeyBytes)
    });
  }
  /**
   * Get public key
   */
  getPublicKey() {
    return this.publicKey;
  }
  /**
   * Get public key as hex string
   */
  async getPublicKeyHex() {
    const exported = await this.suite.SerializePublicKey(this.publicKey);
    return bytesToHex3(exported);
  }
  /**
   * Get private key
   */
  getPrivateKey() {
    return this.privateKey;
  }
  /**
   * Marshal public key configuration for server key distribution
   * Implements RFC 9458 format
   */
  async marshalConfig() {
    const kemId = HPKE_CONFIG.KEM;
    const kdfId = HPKE_CONFIG.KDF;
    const aeadId = HPKE_CONFIG.AEAD;
    const publicKeyBytes = await this.suite.SerializePublicKey(this.publicKey);
    const keyId = 0;
    const publicKeySize = publicKeyBytes.length;
    const cipherSuitesSize = 2 + 2;
    const buffer = new Uint8Array(1 + 2 + publicKeySize + 2 + cipherSuitesSize);
    let offset = 0;
    buffer[offset++] = keyId;
    buffer[offset++] = kemId >> 8 & 255;
    buffer[offset++] = kemId & 255;
    buffer.set(publicKeyBytes, offset);
    offset += publicKeySize;
    buffer[offset++] = cipherSuitesSize >> 8 & 255;
    buffer[offset++] = cipherSuitesSize & 255;
    buffer[offset++] = kdfId >> 8 & 255;
    buffer[offset++] = kdfId & 255;
    buffer[offset++] = aeadId >> 8 & 255;
    buffer[offset++] = aeadId & 255;
    return buffer;
  }
  /**
   * Unmarshal public configuration from server
   */
  static async unmarshalPublicConfig(data) {
    let offset = 0;
    const keyId = data[offset++];
    const kemId = data[offset++] << 8 | data[offset++];
    const publicKeySize = 32;
    const publicKeyBytes = data.slice(offset, offset + publicKeySize);
    offset += publicKeySize;
    const cipherSuitesLength = data[offset++] << 8 | data[offset++];
    const suites = [];
    const cipherSuitesEnd = offset + cipherSuitesLength;
    while (offset < cipherSuitesEnd) {
      const kdfId = data[offset++] << 8 | data[offset++];
      const aeadId = data[offset++] << 8 | data[offset++];
      suites.push({ kdfId, aeadId });
    }
    if (suites.length === 0) {
      throw new ProtocolError("No cipher suites found in config");
    }
    const firstSuite = suites[0];
    if (firstSuite.kdfId !== HPKE_CONFIG.KDF || firstSuite.aeadId !== HPKE_CONFIG.AEAD) {
      throw new ProtocolError(`Unsupported cipher suite: KDF=0x${firstSuite.kdfId.toString(16)}, AEAD=0x${firstSuite.aeadId.toString(16)}`);
    }
    return _Identity.fromPublicKeyBytes(publicKeyBytes);
  }
  /**
   * Create an Identity from a raw public key hex string.
   * Uses the default cipher suite (X25519/HKDF-SHA256/AES-256-GCM).
   *
   * This is used by clients who already have the server's public key
   * and don't need to fetch it.
   */
  static async fromPublicKeyHex(publicKeyHex) {
    const publicKeyBytes = hexToBytes3(publicKeyHex);
    if (publicKeyBytes.length !== 32) {
      throw new ProtocolError(`Invalid public key length: expected 32, got ${publicKeyBytes.length}`);
    }
    return _Identity.fromPublicKeyBytes(publicKeyBytes);
  }
  /**
   * Create an Identity from raw public key bytes.
   * Uses the default cipher suite (X25519/HKDF-SHA256/AES-256-GCM).
   *
   * For public-key-only identities (client-side use), we create a placeholder
   * private key that won't be used. TODO: refactor Identity to not require
   * a private key for client-side use.
   */
  static async fromPublicKeyBytes(publicKeyBytes) {
    const suite = createSuite();
    const publicKey = await suite.DeserializePublicKey(publicKeyBytes);
    const placeholderPrivateKey = await suite.DeserializePrivateKey(new Uint8Array(32), false);
    return new _Identity(suite, publicKey, placeholderPrivateKey);
  }
  /**
   * Encrypt request body and return context for response decryption.
   *
   * This method is called on the SERVER's identity (public key only).
   * It:
   * 1. Creates an HPKE sender context to this identity's public key
   * 2. Encrypts the request body
   * 3. Returns a RequestContext that must be used to decrypt the response
   */
  async encryptRequestWithContext(request) {
    const body = await request.arrayBuffer();
    if (body.byteLength === 0) {
      return {
        request: new Request(request.url, {
          ...forwardedRequestInit(request),
          method: request.method,
          headers: request.headers,
          body: null
        }),
        context: null
      };
    }
    const infoBytes = new TextEncoder().encode(HPKE_REQUEST_INFO);
    const { encapsulatedSecret, ctx } = await this.suite.SetupSender(this.publicKey, {
      info: infoBytes
    });
    const context = {
      senderContext: ctx,
      requestEnc: encapsulatedSecret
    };
    const headers = new Headers(request.headers);
    headers.set(PROTOCOL.ENCAPSULATED_KEY_HEADER, bytesToHex3(context.requestEnc));
    const encrypted = await ctx.Seal(new Uint8Array(body));
    const chunkLength = new Uint8Array(4);
    new DataView(chunkLength.buffer).setUint32(0, encrypted.byteLength, false);
    const chunkedData = new Uint8Array(4 + encrypted.byteLength);
    chunkedData.set(chunkLength, 0);
    chunkedData.set(encrypted, 4);
    return {
      request: new Request(request.url, {
        ...forwardedRequestInit(request),
        method: request.method,
        headers,
        body: chunkedData,
        duplex: "half"
      }),
      context
    };
  }
  /**
   * Decrypt response using keys derived from request context.
   *
   * This method:
   * 1. Reads the response nonce from Ehbp-Response-Nonce header
   * 2. Exports a secret from the HPKE sender context
   * 3. Derives response keys using HKDF
   * 4. Decrypts the response body
   */
  async decryptResponseWithContext(response, context) {
    const token = await extractSessionRecoveryToken(context);
    return decryptResponseWithToken(response, token);
  }
};
async function extractSessionRecoveryToken(context) {
  const exportLabelBytes = new TextEncoder().encode(EXPORT_LABEL);
  const exportedSecret = new Uint8Array(await context.senderContext.Export(exportLabelBytes, EXPORT_LENGTH));
  return {
    exportedSecret,
    requestEnc: new Uint8Array(context.requestEnc)
  };
}
async function decryptResponseWithToken(response, token, onStreamError, onStreamComplete) {
  const responseNonceHex = response.headers.get(PROTOCOL.RESPONSE_NONCE_HEADER);
  if (!response.body && !responseNonceHex) {
    return response;
  }
  if (!responseNonceHex) {
    throw new ProtocolError(`Missing ${PROTOCOL.RESPONSE_NONCE_HEADER} header`);
  }
  const responseNonce = hexToBytes3(responseNonceHex);
  if (responseNonce.length !== RESPONSE_NONCE_LENGTH) {
    throw new ProtocolError(`Invalid response nonce length`);
  }
  if (!response.body) {
    onStreamComplete?.();
    return response;
  }
  const km = await deriveResponseKeys(token.exportedSecret, token.requestEnc, responseNonce);
  const decryptedStream = createDecryptStream(response.body, km, onStreamError, onStreamComplete);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return new Response(decryptedStream, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
var MAX_RESPONSE_CHUNK_BYTES = 64 * 1024 * 1024;
function createDecryptStream(body, km, onStreamError, onStreamComplete) {
  let buffer = new Uint8Array(0);
  let seq = 0;
  const reader = body.getReader();
  let consumerCancelled = false;
  return new ReadableStream({
    async pull(controller) {
      const fail = (error) => {
        try {
          onStreamError?.();
        } catch {
        }
        try {
          controller.error(error);
        } finally {
          reader.cancel(error).catch(() => {
          });
        }
      };
      while (true) {
        if (buffer.length >= 4) {
          const chunkLength = (buffer[0] << 24 | buffer[1] << 16 | buffer[2] << 8 | buffer[3]) >>> 0;
          if (chunkLength === 0) {
            buffer = buffer.slice(4);
            continue;
          }
          if (chunkLength > MAX_RESPONSE_CHUNK_BYTES) {
            fail(new ProtocolError("response chunk exceeds maximum allowed size"));
            return;
          }
          if (buffer.length >= 4 + chunkLength) {
            const ciphertext = buffer.slice(4, 4 + chunkLength);
            buffer = buffer.slice(4 + chunkLength);
            try {
              const plaintext = await decryptChunk(km, seq++, ciphertext);
              controller.enqueue(plaintext);
              return;
            } catch (error) {
              fail(new DecryptionError(`Decryption failed at chunk ${seq - 1}`, { cause: error }));
              return;
            }
          }
        }
        let result;
        try {
          result = await reader.read();
        } catch (error) {
          if (consumerCancelled) {
            return;
          }
          fail(error instanceof Error ? error : new Error("Encrypted response read failed", {
            cause: error
          }));
          return;
        }
        const { done, value } = result;
        if (done) {
          if (consumerCancelled) {
            return;
          }
          if (buffer.length !== 0) {
            fail(new ProtocolError("truncated encrypted response chunk"));
          } else {
            onStreamComplete?.();
            controller.close();
          }
          return;
        }
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
      }
    },
    cancel(reason) {
      consumerCancelled = true;
      return reader.cancel(reason);
    }
  });
}

// node_modules/ehbp/dist/esm/client.js
var MAX_PROBLEM_DETAILS_BYTES = 64 * 1024;
var Transport = class _Transport {
  serverIdentity;
  serverHost;
  _lastSessionRecoveryToken;
  requestGeneration = 0;
  constructor(serverIdentity, serverHost) {
    this.serverIdentity = serverIdentity;
    this.serverHost = serverHost;
  }
  getSessionRecoveryToken() {
    if (!this._lastSessionRecoveryToken) {
      throw new Error("No session recovery token available \u2014 no request has been made yet");
    }
    return this._lastSessionRecoveryToken;
  }
  /**
   * Create a new transport by fetching server public key.
   * The optional init is applied to the key fetch (e.g. credentials).
   */
  static async create(serverURL, init) {
    const url = new URL(serverURL);
    const serverHost = url.host;
    const keysURL = new URL(PROTOCOL.KEYS_PATH, serverURL);
    const response = await fetch(keysURL.toString(), init);
    if (!response.ok) {
      throw new Error(`Failed to get server public key: ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType !== PROTOCOL.KEYS_MEDIA_TYPE) {
      throw new Error(`Invalid content type: ${contentType}`);
    }
    const keysData = new Uint8Array(await response.arrayBuffer());
    const serverIdentity = await Identity.unmarshalPublicConfig(keysData);
    return new _Transport(serverIdentity, serverHost);
  }
  static isProblemJSONContentType(contentType) {
    if (!contentType) {
      return false;
    }
    const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    return mediaType === PROTOCOL.PROBLEM_JSON_MEDIA_TYPE;
  }
  static async checkKeyConfigMismatch(response) {
    if (response.status !== 422)
      return;
    if (!_Transport.isProblemJSONContentType(response.headers.get("content-type")))
      return;
    let problem;
    try {
      const clone = response.clone();
      if (!clone.body)
        return;
      const reader = clone.body.getReader();
      const chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        length += value.byteLength;
        if (length > MAX_PROBLEM_DETAILS_BYTES) {
          reader.cancel().catch(() => {
          });
          return;
        }
        chunks.push(value);
      }
      const body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      problem = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return;
    }
    if (problem?.type === PROTOCOL.KEY_CONFIG_PROBLEM_TYPE) {
      throw new KeyConfigMismatchError(typeof problem.title === "string" ? problem.title : void 0);
    }
  }
  static async shouldDecryptResponse(response) {
    if (response.headers.has(PROTOCOL.RESPONSE_NONCE_HEADER)) {
      return true;
    }
    await _Transport.checkKeyConfigMismatch(response);
    if (!response.ok) {
      return false;
    }
    throw new ProtocolError(`Missing ${PROTOCOL.RESPONSE_NONCE_HEADER} header`);
  }
  /**
   * Get the server identity
   */
  getServerIdentity() {
    return this.serverIdentity;
  }
  /**
   * Get the server public key
   */
  getServerPublicKey() {
    return this.serverIdentity.getPublicKey();
  }
  /**
   * Get the server public key as hex string
   */
  async getServerPublicKeyHex() {
    return this.serverIdentity.getPublicKeyHex();
  }
  /**
   * Make an encrypted HTTP request.
   */
  async request(input, init) {
    const generation = ++this.requestGeneration;
    this._lastSessionRecoveryToken = void 0;
    const inputUrl = input instanceof Request ? input.url : String(input);
    if (inputUrl.startsWith("data:") || inputUrl.startsWith("blob:")) {
      return fetch(input, init);
    }
    const normalizedRequest = new Request(input, init);
    const requestBodyBytes = await normalizedRequest.arrayBuffer();
    const requestBody = requestBodyBytes.byteLength > 0 ? requestBodyBytes : null;
    const url = new URL(normalizedRequest.url);
    url.host = this.serverHost;
    const request = new Request(url.toString(), {
      ...forwardedRequestInit(normalizedRequest),
      method: normalizedRequest.method,
      headers: normalizedRequest.headers,
      body: requestBody,
      duplex: "half"
    });
    const { request: encryptedRequest, context } = await this.serverIdentity.encryptRequestWithContext(request);
    const token = context ? await extractSessionRecoveryToken(context) : void 0;
    const response = await fetch(encryptedRequest);
    if (!token) {
      return response;
    }
    const shouldDecrypt = await _Transport.shouldDecryptResponse(response);
    if (!shouldDecrypt) {
      return response;
    }
    let streamTerminated = false;
    const clearToken = () => {
      streamTerminated = true;
      if (this.requestGeneration === generation) {
        this._lastSessionRecoveryToken = void 0;
      }
    };
    const decryptedResponse = await decryptResponseWithToken(response, token, clearToken, clearToken);
    if (this.requestGeneration === generation) {
      this._lastSessionRecoveryToken = streamTerminated ? void 0 : token;
    }
    return decryptedResponse;
  }
  /**
   * Convenience method for GET requests
   */
  async get(url, init) {
    return this.request(url, { ...init, method: "GET" });
  }
  /**
   * Convenience method for POST requests
   */
  async post(url, body, init) {
    return this.request(url, { ...init, method: "POST", body });
  }
  /**
   * Convenience method for PUT requests
   */
  async put(url, body, init) {
    return this.request(url, { ...init, method: "PUT", body });
  }
  /**
   * Convenience method for DELETE requests
   */
  async delete(url, init) {
    return this.request(url, { ...init, method: "DELETE" });
  }
};

// src/platform/attested-client.ts
function validateEnclavePin(value) {
  const origin = new URL(value.origin);
  if (origin.protocol !== "https:" || origin.origin !== value.origin || origin.username || origin.password || !origin.hostname.endsWith(".containers.tinfoil.dev") || origin.hostname.includes(".debug.") || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(value.repository) || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value.tag) || !/^[a-f0-9]{64}$/.test(value.digest))
    throw new Error("Invalid confidential deployment pin");
  return { origin: origin.origin, repository: value.repository, tag: value.tag, digest: value.digest };
}
function verifyEnclavePin(pin, document, enclave) {
  if (document.securityVerified !== true || document.configRepo !== pin.repository || document.releaseTag !== pin.tag || document.releaseDigest !== pin.digest || enclave !== pin.origin || document.enclaveHost !== new URL(pin.origin).hostname)
    throw new Error("Confidential deployment verification failed");
}
function createAttestedClient(input, create = (options) => new SecureClient(options), seal = async (key, host) => new Transport(await Identity.fromPublicKeyHex(key), host)) {
  const pin = validateEnclavePin(input);
  return async (body, signal) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid confidential request");
    const payload = JSON.stringify(body);
    if (typeof payload !== "string" || new TextEncoder().encode(payload).length > 16777216) throw new Error("Invalid confidential request");
    signal?.throwIfAborted();
    const client = create({ enclaveURL: pin.origin, configRepo: pin.repository, transport: "ehbp" });
    const attestationSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(3e4)]) : AbortSignal.timeout(3e4);
    await new Promise((resolve, reject) => {
      const abort = () => reject(attestationSignal.reason);
      attestationSignal.addEventListener("abort", abort, { once: true });
      if (attestationSignal.aborted) {
        abort();
        return;
      }
      void client.ready().then(() => {
        attestationSignal.removeEventListener("abort", abort);
        resolve();
      }, (error) => {
        attestationSignal.removeEventListener("abort", abort);
        reject(error);
      });
    });
    const document = client.getVerificationDocument();
    verifyEnclavePin(pin, document, client.getEnclaveURL());
    if (!/^[a-f0-9]{64}$/i.test(document.hpkePublicKey)) throw new Error("Confidential deployment key is invalid");
    const transport = await seal(document.hpkePublicKey, new URL(pin.origin).host);
    signal?.throwIfAborted();
    const response = await transport.request(`${pin.origin}/private`, {
      method: "POST",
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Confidential service unavailable");
    }
    return response;
  };
}

// src/platform/bash-grant.ts
import { createHash, createPublicKey, sign, verify } from "node:crypto";
var denied = () => new Error("Bash grant rejected");
function commandDigest(command) {
  return createHash("sha256").update(command).digest("hex");
}
function valid(grant) {
  if (!grant || Object.keys(grant).sort().join(",") !== "audience,boot,command,expires,id,tenant,timeout,version" || grant.version !== 1 || grant.audience !== "sure-confidential-bash" || !/^[a-f0-9]{64}$/.test(grant.boot) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(grant.id) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(grant.tenant) || !/^[a-f0-9]{64}$/.test(grant.command) || !Number.isInteger(grant.timeout) || grant.timeout < 1 || grant.timeout > 60 || !Number.isSafeInteger(grant.expires)) throw denied();
}
function signBashGrant(grant, key) {
  valid(grant);
  if (key.type !== "private" || key.asymmetricKeyType !== "ed25519") throw denied();
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return `${payload}.${sign(null, Buffer.from(payload), key).toString("base64url")}`;
}

// src/platform/bash-pool-lease.ts
import { createHash as createHash2, randomUUID } from "node:crypto";
import { mkdir, lstat, open, rename, unlink } from "node:fs/promises";
import { join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";
var unavailable = () => new Error("Confidential Bash unavailable");
async function acquireBashPoolLease(root, pool, tenant) {
  if (!root.startsWith("/") || normalize(root) !== root || root.includes("\0")) throw unavailable();
  const directory = join(root, createHash2("sha256").update(pool + "\0" + tenant).digest("hex"));
  for (const path2 of [root, directory]) {
    await mkdir(path2, { recursive: true, mode: 448 });
    const info = await lstat(path2);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.() || info.mode & 63) throw unavailable();
  }
  const path = join(directory, "lease.sqlite");
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid?.()) throw unavailable();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const lease = new DatabaseSync(path);
  try {
    lease.exec("PRAGMA busy_timeout=0; BEGIN IMMEDIATE");
  } catch {
    lease.close();
    throw new SandboxBusyError();
  }
  const journal = join(directory, "uncertain.json");
  try {
    await lstat(journal);
    throw unavailable();
  } catch (error) {
    if (error.code !== "ENOENT") {
      lease.close();
      throw error;
    }
  }
  async function sync() {
    const handle = await open(directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  return {
    async dispatched() {
      const staging = journal + "." + randomUUID();
      const file = await open(staging, "wx", 384);
      try {
        await file.writeFile('{"uncertain":true}\n');
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(staging, journal);
      await sync();
    },
    async confirmed() {
      await unlink(journal);
      await sync();
    },
    close() {
      lease.close();
    }
  };
}

// src/platform/tinfoil-pool.ts
var unavailable2 = () => new Error("Confidential Bash unavailable");
function parseTinfoilPoolConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable2();
  const input = value;
  if (Object.keys(input).sort().join(",") !== "digest,origin,poolId,repository,tag" || typeof input.poolId !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(input.poolId)) throw unavailable2();
  return { ...validateEnclavePin(input), poolId: input.poolId };
}
async function readTinfoilPoolConfig() {
  const file = await open2("/etc/calendar-platform/tinfoil-pool.json", constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.uid !== 0 || info.mode & 18 || info.size > 4096) throw unavailable2();
    const bytes = await file.readFile();
    if (bytes.length > 4096) throw unavailable2();
    return parseTinfoilPoolConfig(JSON.parse(bytes.toString("utf8")));
  } finally {
    await file.close();
  }
}
function trustedBashIssuerMetadata(info, uid) {
  const mode = info.mode & 511;
  return info.size > 0 && info.size <= 4096 && (info.uid === 0 && info.gid === 0 && (mode === 256 || mode === 288) || info.uid === uid && mode === 256);
}
async function bashPoolIssuer(directory = process.env.CREDENTIALS_DIRECTORY) {
  if (!directory?.startsWith("/run/credentials/") || normalize2(directory) !== directory) throw unavailable2();
  const file = await open2(join2(directory, "bash-issuer"), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || !trustedBashIssuerMetadata(info, process.getuid?.())) throw unavailable2();
    const key = createPrivateKey(await file.readFile());
    if (key.asymmetricKeyType !== "ed25519") throw unavailable2();
    return key;
  } finally {
    await file.close();
  }
}
async function json(response) {
  const reader = response.body?.getReader();
  if (!reader) throw unavailable2();
  let size = 0;
  const chunks = [];
  try {
    for (; ; ) {
      const { value: value2, done } = await reader.read();
      if (done) break;
      size += value2.byteLength;
      if (size > 16e5) throw unavailable2();
      chunks.push(value2);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable2();
    return value;
  } finally {
    await reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
function createTinfoilPoolExecutor(deps) {
  return async (tenant, command, timeout, signal, authorization) => {
    let lease;
    let dispatched = false;
    try {
      let authorize2 = function(value) {
        if (!value || value.provider !== "tinfoil-pool" || !value.enabled || value.tenantId !== tenant || value.poolId !== config.poolId) throw unavailable2();
      };
      var authorize = authorize2;
      if (typeof authorization?.authorize !== "function") throw unavailable2();
      await authorization.authorize();
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(tenant) || !command.trim() || command.includes("\0") || Buffer.byteLength(command) > 16e3 || !Number.isInteger(timeout) || timeout < 1 || timeout > 60) throw unavailable2();
      const binding = await deps.binding(tenant);
      const config = parseTinfoilPoolConfig(await (deps.config ?? readTinfoilPoolConfig)());
      async function unchangedConfig() {
        const current = parseTinfoilPoolConfig(await (deps.config ?? readTinfoilPoolConfig)());
        if (current.poolId !== config.poolId || current.origin !== config.origin || current.repository !== config.repository || current.tag !== config.tag || current.digest !== config.digest) throw unavailable2();
      }
      authorize2(binding);
      lease = await acquireBashPoolLease(deps.executionRoot ?? "/var/lib/calendar-platform/bash-pool-execution", config.poolId, tenant);
      const deadline = AbortSignal.timeout((timeout + 100) * 1e3);
      const abort = signal ? AbortSignal.any([signal, deadline]) : deadline;
      const request = (deps.client ?? createAttestedClient)(config);
      const status = await json(await request({ operation: "status" }, abort));
      if (Object.keys(status).sort().join(",") !== "boot,version" || status.version !== 1 || typeof status.boot !== "string" || !/^[a-f0-9]{64}$/.test(status.boot)) throw unavailable2();
      const key = await (deps.key ?? bashPoolIssuer)();
      await authorization.authorize();
      await unchangedConfig();
      authorize2(await deps.binding(tenant));
      abort.throwIfAborted();
      const token = signBashGrant({
        version: 1,
        audience: "sure-confidential-bash",
        boot: status.boot,
        id: randomUUID2(),
        tenant,
        command: commandDigest(command),
        timeout,
        expires: Date.now() + 6e4
      }, key);
      await lease.dispatched();
      dispatched = true;
      const result = await json(await request({ operation: "execute", command, timeout, token }, abort));
      if (Object.keys(result).sort().join(",") === "busy,version" && result.version === 1 && result.busy === true) {
        await lease.confirmed();
        dispatched = false;
        throw new SandboxBusyError();
      }
      if (Object.keys(result).sort().join(",") !== "exitCode,output,timedOut,truncated" || !Number.isInteger(result.exitCode) || result.exitCode < 0 || result.exitCode > 255 || typeof result.output !== "string" || Buffer.byteLength(result.output) > 262144 || typeof result.truncated !== "boolean" || typeof result.timedOut !== "boolean") throw unavailable2();
      await lease.confirmed();
      await authorization.authorize();
      await unchangedConfig();
      authorize2(await deps.binding(tenant));
      abort.throwIfAborted();
      return result;
    } catch (error) {
      if (!dispatched && error instanceof SandboxBusyError) throw error;
      throw unavailable2();
    } finally {
      lease?.close();
    }
  };
}
export {
  bashPoolIssuer,
  createTinfoilPoolExecutor,
  parseTinfoilPoolConfig,
  readTinfoilPoolConfig,
  trustedBashIssuerMetadata
};
/*! Bundled license information:

@noble/ciphers/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/edwards.js:
@noble/curves/abstract/montgomery.js:
@noble/curves/ed25519.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
