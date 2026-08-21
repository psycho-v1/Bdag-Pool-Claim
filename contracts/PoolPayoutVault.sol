// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PoolPayoutVault — BlockDAG chain 1404
 * Each pool deploys its own vault. Claim mode for miners.
 * Community RPC only. Confirm each operator tx before the next.
 */
contract PoolPayoutVault {
    address public owner;
    bool public paused;
    mapping(address => bool) public operators;
    mapping(address => uint256) public claimable;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address indexed account, bool allowed);
    event Deposited(address indexed from, uint256 amount);
    event Distributed(address indexed caller, uint256 count, uint256 total);
    event Claimed(address indexed miner, uint256 amount);
    event ClaimableSet(address indexed miner, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Paused(bool status);

    error NotAuthorized();
    error LengthMismatch();
    error ZeroAddress();
    error TransferFailed();
    error InsufficientBalance();
    error ContractPaused();
    error NothingToClaim();

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

    constructor(address initialOperator) {
        owner = msg.sender;
        if (initialOperator != address(0)) {
            operators[initialOperator] = true;
            emit OperatorUpdated(initialOperator, true);
        }
        emit OwnershipTransferred(address(0), msg.sender);
    }

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
    ) external onlyOwnerOrOperator whenNotPaused {
        uint256 len = recipients.length;
        if (len != amounts.length) revert LengthMismatch();
        if (len == 0) return;

        uint256 total;
        for (uint256 i = 0; i < len; ) {
            total += amounts[i];
            unchecked {
                ++i;
            }
        }
        if (address(this).balance < total) revert InsufficientBalance();

        for (uint256 i = 0; i < len; ) {
            address to = recipients[i];
            uint256 amount = amounts[i];
            if (to == address(0)) revert ZeroAddress();
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
            unchecked {
                ++i;
            }
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
            claimable[miners[i]] = amounts[i];
            emit ClaimableSet(miners[i], amounts[i]);
            unchecked {
                ++i;
            }
        }
    }

    function claim() external whenNotPaused {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        if (address(this).balance < amount) revert InsufficientBalance();
        claimable[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(msg.sender, amount);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
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
