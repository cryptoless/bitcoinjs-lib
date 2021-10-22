/// <reference types="node" />
import { Signer } from './ecpair';
import { Network } from './networks';
import { Transaction } from './transaction';
declare type MaybeBuffer = Buffer | undefined;
declare type TxbSignatures = Buffer[] | MaybeBuffer[];
declare type TxbPubkeys = MaybeBuffer[];
declare type TxbWitness = Buffer[];
declare type TxbScriptType = string;
declare type TxbScript = Buffer;
interface TxbInput {
    value?: number;
    hasWitness?: boolean;
    signScript?: TxbScript;
    signType?: TxbScriptType;
    prevOutScript?: TxbScript;
    redeemScript?: TxbScript;
    redeemScriptType?: TxbScriptType;
    prevOutType?: TxbScriptType;
    pubkeys?: TxbPubkeys;
    signatures?: TxbSignatures;
    witness?: TxbWitness;
    witnessScript?: TxbScript;
    witnessScriptType?: TxbScriptType;
    script?: TxbScript;
    sequence?: number;
    scriptSig?: TxbScript;
    maxSignatures?: number;
}
interface TxbSignArg {
    prevOutScriptType: string;
    vin: number;
    keyPair: Signer;
    redeemScript?: Buffer;
    hashType?: number;
    witnessValue?: number;
    witnessScript?: Buffer;
}
export declare class TransactionBuilder {
    network: Network;
    maximumFeeRate: number;
    static fromTransaction(transaction: Transaction, network?: Network): TransactionBuilder;
    private __PREV_TX_SET;
    private __INPUTS;
    private __TX;
    private __USE_LOW_R;
    constructor(network?: Network, maximumFeeRate?: number);
    setLowR(setting?: boolean): boolean;
    setLockTime(locktime: number): void;
    setVersion(version: number): void;
    addInput(txHash: Buffer | string | Transaction, vout: number, sequence?: number, prevOutScript?: Buffer): number;
    addOutput(scriptPubKey: string | Buffer, value: number): number;
    build(): Transaction;
    buildIncomplete(): Transaction;
    getSigningData(vin: number, ourPubKey: Buffer, redeemScript?: Buffer, hashType?: number, witnessValue?: number, witnessScript?: Buffer): Omit<SigningData, 'keyPair'>;
    signInput(vin: number, ourPubKey: Buffer, signature: Buffer, hashType: number): void;
    sign(signParams: number | TxbSignArg, keyPair?: Signer, redeemScript?: Buffer, hashType?: number, witnessValue?: number, witnessScript?: Buffer): void;
    private __addInputUnsafe;
    private __build;
    private __canModifyInputs;
    private __needsOutputs;
    private __canModifyOutputs;
    private __overMaximumFees;
}
interface SigningData {
    input: TxbInput;
    ourPubKey: Buffer;
    keyPair: Signer;
    signatureHash: Buffer;
    hashType: number;
    useLowR: boolean;
}
export {};
