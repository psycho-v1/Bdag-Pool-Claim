// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Minimal ERC1967 proxy for PoolPayoutVaultUpgradeable.
 * Users always interact with THIS address. Implementation can change.
 *
 * Deploy:
 *   1. Deploy PoolPayoutVaultUpgradeable (implementation)
 *   2. Deploy VaultProxy(implementation, initCalldata)
 *      initCalldata = abi.encodeWithSignature("initialize(address,address)", owner, operator)
 */

contract VaultProxy {
    // keccak256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    error ProxyDelegateFailed();

    constructor(address implementation_, bytes memory initData) {
        require(implementation_.code.length > 0, "invalid impl");
        assembly {
            sstore(IMPLEMENTATION_SLOT, implementation_)
        }
        if (initData.length > 0) {
            (bool ok, ) = implementation_.delegatecall(initData);
            require(ok, "init failed");
        }
    }

    fallback() external payable {
        _delegate();
    }

    receive() external payable {
        _delegate();
    }

    function _delegate() internal {
        assembly {
            let impl := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
