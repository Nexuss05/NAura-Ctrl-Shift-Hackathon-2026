/**
 * NAura — EIP-712 Secret Derivation Payload Builder
 * 
 * Reconstructed from Privacy Pools v2 sample app:
 *   privacy-pools-core/apps/sample/src/keystore/secretDerivationPayload.ts
 * 
 * This builds the EIP-712 typed data payload that the wallet signs once.
 * The resulting signature is used to deterministically derive protocol keys.
 */

import { keccak256, encodePacked } from 'viem';

/**
 * Build the EIP-712 typed data payload for PP v2 key derivation.
 * @param {string} address - The signer's EVM address (0x-prefixed)
 * @returns {object} EIP-712 typed data suitable for walletClient.signTypedData()
 */
export function buildSecretDerivationPayload(address) {
  // Hash the address to create the addressHash field
  const addressHash = keccak256(
    encodePacked(['address'], [address])
  );

  return {
    domain: {
      name: 'PrivacyPools',
      version: '2',
      chainId: 11155111, // Sepolia
    },
    types: {
      DeriveSecretKeys: [
        { name: 'addressHash', type: 'bytes32' },
        { name: 'message', type: 'string' },
      ],
    },
    primaryType: 'DeriveSecretKeys',
    message: {
      addressHash,
      message:
        'Sign this message to derive your Privacy Pools secret keys. This signature never leaves your device.',
    },
  };
}
