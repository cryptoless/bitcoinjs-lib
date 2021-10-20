// key path spend - {signature}
// script path spend - [...stack elements] {tapscript} {control block}
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki

import * as bscript from '../../script';
import * as taproot from '../../taproot';

export function check(chunks: Buffer[]): boolean {
  chunks = taproot.removeAnnex(chunks);

  if (chunks.length === 0) {
    return false;
  } else if (chunks.length === 1) {
    // possible key path spend
    return bscript.isCanonicalSchnorrSignature(chunks[0]);
  } else {
    // possible script path spend
    return taproot.isScriptPathSpend(chunks);
  }
}
check.toJSON = (): string => {
  return 'taproot input';
};
