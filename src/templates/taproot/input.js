'use strict';
// key path spend - {signature}
// script path spend - [...stack elements] {tapscript} {control block}
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
Object.defineProperty(exports, '__esModule', { value: true });
exports.check = void 0;
const bscript = require('../../script');
const taproot = require('../../taproot');
function check(chunks) {
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
exports.check = check;
check.toJSON = () => {
  return 'taproot input';
};
