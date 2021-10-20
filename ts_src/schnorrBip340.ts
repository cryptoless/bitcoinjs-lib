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

import * as BN from 'bn.js';
import { curve, ec as EC } from 'elliptic';
const { createHash } = require('crypto');
const secp256k1 = new EC('secp256k1');

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

function fromBuffer(d: Buffer): BN {
  return new BN(d);
}
function toBuffer(d: BN): Buffer {
  return d.toArrayLike(Buffer, 'be', 32);
}

const n = secp256k1.curve.n;
const G = secp256k1.curve.g;

function isScalar(x: Buffer): boolean {
  return Buffer.isBuffer(x) && x.length === 32;
}

function isPrivate(x: Buffer): boolean {
  if (!isScalar(x)) return false;
  return (
    x.compare(ZERO32) > 0 && x.compare(EC_GROUP_ORDER) < 0 // > 0
  ); // < G
}

const TWO = new BN(2);

function sha256(message: Buffer): Buffer {
  return createHash('sha256')
    .update(message)
    .digest();
}

// TODO(BG-37835): consolidate with taggedHash in `p2tr.ts`
function taggedHash(tagString: string, msg: Buffer): Buffer {
  if (typeof tagString !== 'string') {
    throw new TypeError('invalid argument');
  }
  if (!Buffer.isBuffer(msg)) {
    throw new TypeError('invalid argument');
  }
  const tagHash = sha256(Buffer.from(tagString, 'utf8'));
  return sha256(Buffer.concat([tagHash, tagHash, msg]));
}

function decodeXOnlyPoint(bytes: Buffer): curve.base.BasePoint {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) {
    throw new Error('invalid pubkey');
  }
  if (bytes.compare(EC_P) >= 0) {
    throw new Error('invalid pubkey');
  }
  return secp256k1.curve.pointFromX(fromBuffer(bytes), /* odd */ false);
}

function encodeXOnlyPoint(P: curve.base.BasePoint): Buffer {
  return toBuffer(P.getX());
}

function hasEvenY(P: curve.base.BasePoint): boolean {
  return (
    !P.isInfinity() &&
    P.getY()
      .umod(TWO)
      .isZero()
  );
}

export function isXOnlyPoint(x: Buffer): boolean {
  try {
    decodeXOnlyPoint(x);
    return true;
  } catch (e) {
    return false;
  }
}

function isSignature(value: Buffer): boolean {
  if (!Buffer.isBuffer(value) || value.length !== 64) {
    return false;
  }
  const r = value.slice(0, 32);
  const s = value.slice(32, 64);
  return r.compare(EC_GROUP_ORDER) < 0 && s.compare(EC_GROUP_ORDER) < 0;
}

export function verifySchnorr(
  hash: Buffer,
  q: Buffer,
  signature: Buffer,
): boolean {
  // See https://github.com/bitcoin/bips/blob/a79eb556f37fdac96364db546864cbb9ba0cc634/bip-0340/reference.py#L124
  // for reference.
  if (!isScalar(hash)) throw new TypeError(THROW_BAD_HASH);
  if (!isXOnlyPoint(q)) throw new TypeError(THROW_BAD_POINT);
  if (!isSignature(signature)) throw new TypeError(THROW_BAD_SIGNATURE);

  const P = decodeXOnlyPoint(q);
  const r = fromBuffer(signature.slice(0, 32));
  const s = fromBuffer(signature.slice(32, 64));
  const e = fromBuffer(
    taggedHash(
      'BIP0340/challenge',
      Buffer.concat([signature.slice(0, 32), q, hash]),
    ),
  ).mod(n);
  const R = G.mul(s).add(P.mul(n.sub(e)));
  return !R.isInfinity() && hasEvenY(R) && R.getX().eq(r);
}

function __signSchnorr(hash: Buffer, d: Buffer, extraData: Buffer): Buffer {
  // See https://github.com/bitcoin/bips/blob/a79eb556f37fdac96364db546864cbb9ba0cc634/bip-0340/reference.py#L99
  // for reference.
  if (!isScalar(hash)) throw new TypeError(THROW_BAD_HASH);
  if (!isPrivate(d)) throw new TypeError(THROW_BAD_PRIVATE);
  if (!Buffer.isBuffer(extraData) || extraData.length !== 32) {
    throw new TypeError(THROW_BAD_EXTRA_DATA);
  }
  let dd = fromBuffer(d);
  const P = G.mul(dd);
  dd = hasEvenY(P) ? dd : n.sub(dd);
  const t = dd.xor(fromBuffer(taggedHash('BIP0340/aux', extraData)));
  const k0 = fromBuffer(
    taggedHash(
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
    taggedHash(
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

export function signSchnorr(hash: Buffer, d: Buffer): Buffer {
  return __signSchnorr(hash, d, Buffer.alloc(32));
}

export function signSchnorrWithEntropy(
  hash: Buffer,
  d: Buffer,
  auxRand: Buffer,
): Buffer {
  return __signSchnorr(hash, d, auxRand);
}
