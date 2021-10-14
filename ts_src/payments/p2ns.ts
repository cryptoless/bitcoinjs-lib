import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import { Payment, PaymentOpts, Stack } from './index';
import * as lazy from './lazy';
const OPS = bscript.OPS;
const typef = require('typeforce');
const ecc = require('tiny-secp256k1');

function stacksEqual(a: Buffer[], b: Buffer[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((x, i) => {
    return x.equals(b[i]);
  });
}

// input: [signatures ...]
// output: [pubKeys[0:n-1] OP_CHECKSIGVERIFY] pubKeys[n-1] OP_CHECKSIG
export function p2ns(a: Payment, opts?: PaymentOpts): Payment {
  if (!a.input && !a.output && !a.pubkeys && !a.signatures)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  function isAcceptableSignature(x: Buffer | number): boolean {
    return (
      bscript.isCanonicalSchnorrSignature(x as Buffer) ||
      (opts!.allowIncomplete && (x as number) === OPS.OP_0) !== undefined
    );
  }

  typef(
    {
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.Buffer),
      pubkeys: typef.maybe(typef.arrayOf(ecc.isPoint)),

      signatures: typef.maybe(typef.arrayOf(isAcceptableSignature)),
      input: typef.maybe(typef.Buffer),
    },
    a,
  );

  const network = a.network || BITCOIN_NETWORK;
  const o: Payment = { network };

  let chunks: Stack = [];
  let decoded = false;
  function decode(output: Buffer | Stack): void {
    if (decoded) return;
    decoded = true;
    chunks = bscript.decompile(output) as Stack;
    o.pubkeys = chunks.filter((_, index) => index % 2 === 0) as Buffer[];
  }

  lazy.prop(o, 'output', () => {
    if (!a.pubkeys) return;
    return bscript.compile(
      ([] as Stack).concat(
        ...a.pubkeys.map((pk, i, pks) => [
          pk,
          i !== pks.length - 1 ? OPS.OP_CHECKSIGVERIFY : OPS.OP_CHECKSIG,
        ]),
      ),
    );
  });
  lazy.prop(o, 'n', () => {
    if (!o.pubkeys) return;
    return o.pubkeys.length;
  });
  lazy.prop(o, 'pubkeys', () => {
    if (!a.output) return;
    decode(a.output);
    return o.pubkeys;
  });
  lazy.prop(o, 'signatures', () => {
    if (!a.input) return;
    return bscript.decompile(a.input);
  });
  lazy.prop(o, 'input', () => {
    if (!a.signatures) return;
    return bscript.compile(a.signatures);
  });
  lazy.prop(o, 'witness', () => {
    if (!o.input) return;
    return [];
  });
  lazy.prop(o, 'name', () => {
    if (!o.n) return;
    return `p2ns(${o.n})`;
  });

  // extended validation
  if (opts.validate) {
    if (a.output) {
      decode(a.output);
      if (!typef.Number(chunks[0])) throw new TypeError('Output is invalid');
      if (chunks[chunks.length - 1] !== OPS.OP_CHECKSIG)
        throw new TypeError('Output is invalid');

      if (o.n! > 16 || o.n !== chunks.length / 2)
        throw new TypeError('Output is invalid');
      if (!o.pubkeys!.every(x => ecc.isPoint(x)))
        throw new TypeError('Output is invalid');

      if (a.pubkeys && !stacksEqual(a.pubkeys, o.pubkeys!))
        throw new TypeError('Pubkeys mismatch');
    }

    if (a.pubkeys) {
      o.n = a.pubkeys.length;
    }

    if (a.signatures) {
      if (a.signatures.length < o.n!)
        throw new TypeError('Not enough signatures provided');
      if (a.signatures.length > o.n!)
        throw new TypeError('Too many signatures provided');
    }

    if (a.input) {
      if (
        o.signatures!.length === 0 ||
        !o.signatures!.every(isAcceptableSignature)
      )
        throw new TypeError('Input has invalid signature(s)');

      if (a.signatures && !stacksEqual(a.signatures, o.signatures!))
        throw new TypeError('Signature mismatch');
      if (o.n !== a.signatures!.length)
        throw new TypeError('Signature count mismatch');
    }
  }

  return Object.assign(o, a);
}
