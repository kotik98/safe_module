// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Enum.sol";

interface GnosisSafe {
    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, Enum.Operation operation)
        external
        returns (bool success);
}

contract WhitelistingModule {
    ///@dev address that this modle will pass transactions to
    address public target;

    mapping (address => bool) isWhite;
    mapping (address => string) funcs;
    mapping (string => string) args;

    event TargetSet(address indexed previousTarget, address indexed newTarget);

    constructor(address _target) {
      target = _target;   
    }

    modifier onlyOwner {
      require(msg.sender == target);
      _;
    }

    function setTarget(address _target) external onlyOwner {
        address previousTarget = target;
        target = _target;
        emit TargetSet(previousTarget, _target);
    }

    function addNewAddress(address delegate) external onlyOwner {
        isWhite[delegate] = true;
    }

    function removeFromList(address removable) external onlyOwner {
        isWhite[removable] = false;            
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) external returns (bool success) {
        require(isWhite[to] == true, "The address not found");
        success = GnosisSafe(target).execTransactionFromModule(
            to,
            value,
            data,
            operation
        );
        return success;
    }
}