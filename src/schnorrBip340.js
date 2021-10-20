'use strict';
/**
 * This file contains a plain javascript implementation of some basic schnorr
 * signing and verification methods as defined in bip-0340:
 * https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
 *
 * These methods are not intended for production use.
 *
 * Implementation mostly follows
 * https://github.com/bitcoin/bips/blob/master/bip-0340/reference.py
 *
 * This is a stop-gap measure until BitGoJS has full WebAssembly support and
 * can use tiny-secp256k1@2
 *
 * Functions and variable naming conventions are lifted from
 * https://github.com/bitcoinjs/tiny-secp256k1/blob/v1.1.6/js.js
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.signSchnorrWithoutExtraData = exports.signSchnorr = exports.verifySchnorr = exports.isXOnlyPoint = void 0;
const BN = require('bn.js');
const elliptic_1 = require('elliptic');
const taggedHash_1 = require('./taggedHash');
const secp256k1 = new elliptic_1.ec('secp256k1');
const ZERO32 = Buffer.alloc(32, 0);
const EC_GROUP_ORDER = Buffer.from(
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  'hex',
);
const EC_P = Buffer.from(
  'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
  'hex',
);
const THROW_BAD_PRIVATE = 'Expected Private';
const THROW_BAD_POINT = 'Expected Point';
const THROW_BAD_HASH = 'Expected Hash';
const THROW_BAD_SIGNATURE = 'Expected Signature';
const THROW_BAD_EXTRA_DATA = 'Expected Extra Data (32 bytes)';
function fromBuffer(d) {
  return new BN(d);
}
function toBuffer(d) {
  return d.toArrayLike(Buffer, 'be', 32);
}
const n = secp256k1.curve.n;
const G = secp256k1.curve.g;
function isScalar(x) {
  return Buffer.isBuffer(x) && x.length === 32;
}
function isPrivate(x) {
  if (!isScalar(x)) return false;
  return (
    x.compare(ZERO32) > 0 && x.compare(EC_GROUP_ORDER) < 0 // > 0
  ); // < G
}
const TWO = new BN(2);
function decodeXOnlyPoint(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) {
    throw new Error('invalid pubkey');
  }
  if (bytes.compare(EC_P) >= 0) {
    throw new Error('invalid pubkey');
  }
  return secp256k1.curve.pointFromX(fromBuffer(bytes), /* odd */ false);
}
function encodeXOnlyPoint(P) {
  return toBuffer(P.getX());
}
function hasEvenY(P) {
  return (
    !P.isInfinity() &&
    P.getY()
      .umod(TWO)
      .isZero()
  );
}
/**
 * @param x - Buffer
 * @return {Boolean} - true iff x is a valid 32-byte x-only public key buffer
 */
function isXOnlyPoint(x) {
  try {
    decodeXOnlyPoint(x);
    return true;
  } catch (e) {
    return false;
  }
}
exports.isXOnlyPoint = isXOnlyPoint;
function isSignature(value) {
  if (!Buffer.isBuffer(value) || value.length !== 64) {
    return false;
  }
  const r = value.slice(0, 32);
  const s = value.slice(32, 64);
  return r.compare(EC_GROUP_ORDER) < 0 && s.compare(EC_GROUP_ORDER) < 0;
}
/**
 * @param hash - message hash
 * @param q - public key buffer (x-only format, 32 byte)
 * @param signature - schnorr signature (64 bytes)
 * @throws {TypeError} - if any of the arguments is invalid
 * @return {Boolean} - true iff the signature is valid
 */
function verifySchnorr(hash, q, signature) {
  // See https://github.com/bitcoin/bips/blob/a79eb556f37fdac96364db546864cbb9ba0cc634/bip-0340/reference.py#L124
  // for reference.
  if (!isScalar(hash)) throw new TypeError(THROW_BAD_HASH);
  if (!isXOnlyPoint(q)) throw new TypeError(THROW_BAD_POINT);
  if (!isSignature(signature)) throw new TypeError(THROW_BAD_SIGNATURE);
  const P = decodeXOnlyPoint(q);
  const r = fromBuffer(signature.slice(0, 32));
  const s = fromBuffer(signature.slice(32, 64));
  const e = fromBuffer(
    (0, taggedHash_1.taggedHash)(
      'BIP0340/challenge',
      Buffer.concat([signature.slice(0, 32), q, hash]),
    ),
  ).mod(n);
  const R = G.mul(s).add(P.mul(n.sub(e)));
  return !R.isInfinity() && hasEvenY(R) && R.getX().eq(r);
}
exports.verifySchnorr = verifySchnorr;
function __signSchnorr(hash, d, extraData) {
  // See https://github.com/bitcoin/bips/blob/a79eb556f37fdac96364db546864cbb9ba0cc634/bip-0340/reference.py#L99
  // for reference.
  if (!isScalar(hash)) throw new TypeError(THROW_BAD_HASH);
  if (!isPrivate(d)) throw new TypeError(THROW_BAD_PRIVATE);
  if (extraData !== undefined) {
    if (!Buffer.isBuffer(extraData) || extraData.length !== 32) {
      throw new TypeError(THROW_BAD_EXTRA_DATA);
    }
  }
  let dd = fromBuffer(d);
  const P = G.mul(dd);
  dd = hasEvenY(P) ? dd : n.sub(dd);
  const t = extraData
    ? dd.xor(fromBuffer((0, taggedHash_1.taggedHash)('BIP0340/aux', extraData)))
    : dd;
  const k0 = fromBuffer(
    (0, taggedHash_1.taggedHash)(
      'BIP0340/nonce',
      Buffer.concat([toBuffer(t), encodeXOnlyPoint(P), hash]),
    ),
  );
  if (k0.isZero()) {
    throw new Error(
      `Failure (k0===0). This happens only with negligible probability.`,
    );
  }
  const R = G.mul(k0);
  if (R.isInfinity()) {
    throw new Error(`R at Infinity`);
  }
  const k = hasEvenY(R) ? k0 : n.sub(k0);
  const e = fromBuffer(
    (0, taggedHash_1.taggedHash)(
      'BIP0340/challenge',
      Buffer.concat([encodeXOnlyPoint(R), encodeXOnlyPoint(P), hash]),
    ),
  ).mod(n);
  const sig = Buffer.concat([
    encodeXOnlyPoint(R),
    toBuffer(k.add(e.mul(dd)).mod(n)),
  ]);
  if (!verifySchnorr(hash, encodeXOnlyPoint(P), sig)) {
    throw new Error('The created signature does not pass verification.');
  }
  return sig;
}
/**
 * Create signature with extraData
 *
 * Quote BIP0340:
 * ```
 * The auxiliary random data should be set to fresh randomness generated at
 * signing time, resulting in what is called a synthetic nonce.
 * Using 32 bytes of randomness is optimal.
 * ...
 * Note that while this means the resulting nonce is not deterministic,
 * the randomness is only supplemental to security.
 * ```
 *
 * @param hash - the message hash
 * @param d - the private key buffer
 * @param extraData - aka auxiliary random data
 * @return {Buffer} - signature
 */
function signSchnorr(hash, d, extraData) {
  return __signSchnorr(hash, d, extraData);
}
exports.signSchnorr = signSchnorr;
/**
 * Create signature without external randomness.
 * This slightly reduces security.
 * Use only if no external randomness is available.
 * Quote from BIP0340:
 *
 * ```
 * Using any non-repeating value increases protection against fault injection
 * attacks. Using unpredictable randomness additionally increases protection
 * against other side-channel attacks, and is recommended whenever available.
 * Note that while this means the resulting nonce is not deterministic,
 * the randomness is only supplemental to security.
 * ```
 *
 * @param hash - the message hash
 * @param d - the private key buffer
 * @return {Buffer} - signature
 */
function signSchnorrWithoutExtraData(hash, d) {
  return __signSchnorr(hash, d);
}
exports.signSchnorrWithoutExtraData = signSchnorrWithoutExtraData;
