// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PoolPayoutVault — Upgradeable (UUPS-style) implementation
 * BlockDAG chain 1404
 *
 * Storage lives in the proxy. This contract is the logic.
 * Owner can upgrade via upgradeTo() / upgradeToAndCall().
 *
 * Deploy flow:
 *   1. Deploy this implementation
 *   2. Deploy VaultProxy pointing at this implementation + init data
 *   3. Users always interact with the PROXY address (never changes)
 */

library ERC1967Storage {
    // keccak256("eip1967.proxy.implementation") - 1
    bytes32 internal constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // keccak256("eip1967.proxy.admin") - 1  (we use owner in logic instead for UUPS)
}

contract PoolPayoutVaultUpgradeable {
    // ===== Storage (order must stay compatible across upgrades) =====
    address public owner;
    bool public paused;
    bool private _initialized;
    uint256 private _status; // reentrancy

    mapping(address => bool) public operators;
    mapping(address => uint256) public claimable;

    uint256 public constant MIN_CLAIM = 1e15; // 0.001 BDAG
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    // ===== Events =====
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address indexed account, bool allowed);
    event Deposited(address indexed from, uint256 amount);
    event Distributed(address indexed caller, uint256 count, uint256 total);
    event Claimed(address indexed miner, uint256 amount);
    event ClaimableSet(address indexed miner, uint256 oldAmount, uint256 newAmount);
    event ClaimableIncreased(address indexed miner, uint256 added, uint256 newTotal);
    event Withdrawn(address indexed to, uint256 amount);
    event Paused(bool status);
    event Upgraded(address indexed implementation);

    // ===== Errors =====
    error NotAuthorized();
    error LengthMismatch();
    error ZeroAddress();
    error TransferFailed();
    error InsufficientBalance();
    error ContractPaused();
    error NothingToClaim();
    error AmountTooSmall();
    error Reentrancy();
    error AlreadyInitialized();
    error InvalidImplementation();

    // ===== Modifiers =====
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyOwnerOrOperator() {
        if (msg.sender != owner && !operators[msg.sender]) revert NotAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier nonReentrant() {
        if (_status == ENTERED) revert Reentrancy();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }

    // ===== Initializer (replaces constructor for proxies) =====
    function initialize(address initialOwner, address initialOperator) external {
        if (_initialized) revert AlreadyInitialized();
        if (initialOwner == address(0)) revert ZeroAddress();
        _initialized = true;
        _status = NOT_ENTERED;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
        if (initialOperator != address(0)) {
            operators[initialOperator] = true;
            emit OperatorUpdated(initialOperator, true);
        }
    }

    // ===== Upgrade (UUPS) =====
    function upgradeTo(address newImplementation) external onlyOwner {
        _upgradeTo(newImplementation);
    }

    function upgradeToAndCall(address newImplementation, bytes calldata data) external onlyOwner {
        _upgradeTo(newImplementation);
        if (data.length > 0) {
            (bool ok, ) = newImplementation.delegatecall(data);
            if (!ok) revert TransferFailed();
        }
    }

    function _upgradeTo(address newImplementation) internal {
        if (newImplementation == address(0)) revert ZeroAddress();
        if (newImplementation.code.length == 0) revert InvalidImplementation();
        bytes32 slot = ERC1967Storage.IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImplementation)
        }
        emit Upgraded(newImplementation);
    }

    function implementation() external view returns (address impl) {
        bytes32 slot = ERC1967Storage.IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }

    // ===== Core vault logic =====
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function setOperator(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        operators[account] = allowed;
        emit OperatorUpdated(account, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setPaused(bool status) external onlyOwner {
        paused = status;
        emit Paused(status);
    }

    function distribute(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwnerOrOperator whenNotPaused nonReentrant {
        uint256 len = recipients.length;
        if (len != amounts.length) revert LengthMismatch();
        if (len == 0) return;

        uint256 total;
        for (uint256 i = 0; i < len; ) {
            if (amounts[i] < MIN_CLAIM) revert AmountTooSmall();
            total += amounts[i];
            unchecked { ++i; }
        }
        if (address(this).balance < total) revert InsufficientBalance();

        for (uint256 i = 0; i < len; ) {
            address to = recipients[i];
            uint256 amount = amounts[i];
            if (to == address(0)) revert ZeroAddress();
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
            unchecked { ++i; }
        }
        emit Distributed(msg.sender, len, total);
    }

    function setClaimable(
        address[] calldata miners,
        uint256[] calldata amounts
    ) external onlyOwnerOrOperator whenNotPaused {
        if (miners.length != amounts.length) revert LengthMismatch();
        for (uint256 i = 0; i < miners.length; ) {
            if (miners[i] == address(0)) revert ZeroAddress();
            if (amounts[i] != 0 && amounts[i] < MIN_CLAIM) revert AmountTooSmall();
            uint256 old = claimable[miners[i]];
            claimable[miners[i]] = amounts[i];
            emit ClaimableSet(miners[i], old, amounts[i]);
            unchecked { ++i; }
        }
    }

    function increaseClaimable(
        address[] calldata miners,
        uint256[] calldata amounts
    ) external onlyOwnerOrOperator whenNotPaused {
        if (miners.length != amounts.length) revert LengthMismatch();
        for (uint256 i = 0; i < miners.length; ) {
            if (miners[i] == address(0)) revert ZeroAddress();
            if (amounts[i] < MIN_CLAIM) revert AmountTooSmall();
            uint256 newTotal = claimable[miners[i]] + amounts[i];
            claimable[miners[i]] = newTotal;
            emit ClaimableIncreased(miners[i], amounts[i], newTotal);
            unchecked { ++i; }
        }
    }

    function claim() external whenNotPaused nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        if (amount < MIN_CLAIM) revert AmountTooSmall();
        if (address(this).balance < amount) revert InsufficientBalance();

        claimable[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(msg.sender, amount);
    }

    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
