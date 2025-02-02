import * as bip32 from 'bip32';
import * as address from './address';
import * as classify from './classify';
import * as crypto from './crypto';
import * as ECPair from './ecpair';
import * as networks from './networks';
import * as payments from './payments';
import * as schnorrBip340 from './schnorrBip340';
import * as script from './script';
import * as ScriptSignature from './script_signature';
import * as taproot from './taproot';

export {
  ECPair,
  ScriptSignature,
  address,
  bip32,
  classify,
  crypto,
  networks,
  payments,
  schnorrBip340,
  script,
  taproot,
};

export { Block } from './block';
export { Psbt, PsbtTxInput, PsbtTxOutput } from './psbt';
export { OPS as opcodes } from './script';
export { Transaction } from './transaction';
export { TransactionBuilder } from './transaction_builder';

export { BIP32Interface } from 'bip32';
export { ECPairInterface, Signer, SignerAsync } from './ecpair';
export { Network } from './networks';
export {
  Payment,
  PaymentCreator,
  PaymentOpts,
  Stack,
  StackElement,
} from './payments';
export { OpCode } from './script';
export { Input as TxInput, Output as TxOutput } from './transaction';
