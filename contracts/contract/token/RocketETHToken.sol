pragma solidity 0.6.12;

// SPDX-License-Identifier: GPL-3.0-only

import "./StandardToken.sol";
import "../RocketBase.sol";
import "../../interface/network/RocketNetworkBalancesInterface.sol";
import "../../interface/token/RocketETHTokenInterface.sol";

// rETH is a tokenized stake in the Rocket Pool network
// rETH is backed by ETH, subject to liquidity
// rETH exposes token balances in terms of expected ETH trade value

// TODO: update Transfer and Approval events to log expected amounts

contract RocketETHToken is RocketBase, StandardToken, RocketETHTokenInterface {

    // Events
    event EtherDeposited(address indexed from, uint256 amount, uint256 time);
    event TokensMinted(address indexed to, uint256 amount, uint256 actualAmount, uint256 time);
    event TokensBurned(address indexed from, uint256 amount, uint256 actualAmount, uint256 time);

    // Construct
    constructor(address _rocketStorageAddress) RocketBase(_rocketStorageAddress) public {
        version = 1;
    }

    // Get the total token supply
    function totalSupply() override public view returns (uint256) {
        return getExpectedAmount(tokenSupply);
    }
    function actualTotalSupply() public view returns (uint256) {
        return tokenSupply;
    }

    // Get the balance of an address
    function balanceOf(address _owner) override(ERC20, StandardToken) public view returns (uint256) {
        return getExpectedAmount(super.balanceOf(_owner));
    }
    function actualBalanceOf(address _owner) public view returns (uint256) {
        return super.balanceOf(_owner);
    }

    // Get the transfer allowance of a spender address for an owner address
    function allowance(address _owner, address _spender) override(ERC20, StandardToken) public view returns (uint256) {
        return getExpectedAmount(super.allowance(_owner, _spender));
    }
    function actualAllowance(address _owner, address _spender) public view returns (uint256) {
        return super.allowance(_owner, _spender);
    }

    // Transfer tokens to an address
    function transfer(address _to, uint256 _value) override(ERC20, StandardToken) public returns (bool) {
        return super.transfer(_to, getActualAmount(_value));
    }

    // Transfer tokens from one address to another as a spender
    function transferFrom(address _from, address _to, uint256 _value) override(ERC20, StandardToken) public returns (bool) {
        return super.transferFrom(_from, _to, getActualAmount(_value));
    }

    // Approve a spender address to transfer tokens
    function approve(address _spender, uint256 _value) override(ERC20, StandardToken) public returns (bool) {
        return super.approve(_spender, getActualAmount(_value));
    }

    // Get the current ETH collateral rate
    // Returns the portion of rETH backed by ETH in the contract as a fraction of 1 ether
    function getCollateralRate() override public view returns (uint256) {
        uint256 calcBase = 1 ether;
        uint256 totalEthValue = totalSupply();
        if (totalEthValue == 0) { return calcBase; }
        return calcBase.mul(address(this).balance).div(totalEthValue);
    }

    // Deposit ETH
    // Only accepts calls from the RocketNetworkWithdrawal contract
    function deposit() override external payable onlyLatestContract("rocketNetworkWithdrawal", msg.sender) {
        // Emit ether deposited event
        emit EtherDeposited(msg.sender, msg.value, now);
    }

    // Mint rETH
    // Only accepts calls from the RocketDepositPool contract
    function mint(uint256 _amount, address _to) override external onlyLatestContract("rocketDepositPool", msg.sender) {
        // Get actual amount
        uint256 actualAmount = getActualAmount(_amount);
        // Check amount
        require(actualAmount > 0, "Invalid token mint amount");
        // Update balance & supply
        balances[_to] = balances[_to].add(actualAmount);
        tokenSupply = tokenSupply.add(actualAmount);
        // Emit tokens minted event
        emit TokensMinted(_to, _amount, actualAmount, now);
    }

    // Burn rETH for ETH
    function burn(uint256 _amount) override external {
        // Get actual amount
        uint256 actualAmount = getActualAmount(_amount);
        // Check amount
        require(actualAmount > 0, "Invalid token burn amount");
        require(balances[msg.sender] >= actualAmount, "Insufficient rETH balance");
        // Check ETH balance
        require(address(this).balance >= _amount, "Insufficient ETH balance for exchange");
        // Update balance & supply
        balances[msg.sender] = balances[msg.sender].sub(actualAmount);
        tokenSupply = tokenSupply.sub(actualAmount);
        // Transfer ETH to sender
        msg.sender.transfer(_amount);
        // Emit tokens burned event
        emit TokensBurned(msg.sender, _amount, actualAmount, now);
    }

    // Calculate the expected token amount (including rewards) from an actual token amount
    function getExpectedAmount(uint256 _actualAmount) private view returns (uint256) {
        // Get network balances
        RocketNetworkBalancesInterface rocketNetworkBalances = RocketNetworkBalancesInterface(getContractAddress("rocketNetworkBalances"));
        uint256 totalEthBalance = rocketNetworkBalances.getTotalETHBalance();
        uint256 rethSupply = rocketNetworkBalances.getTotalRETHSupply();
        // Calculate and return
        if (rethSupply == 0) { return _actualAmount; }
        return _actualAmount.mul(totalEthBalance).div(rethSupply);
    }

    // Calculate the actual token amount from an expected token amount (including rewards)
    function getActualAmount(uint256 _expectedAmount) private view returns (uint256) {
        // Get network balances
        RocketNetworkBalancesInterface rocketNetworkBalances = RocketNetworkBalancesInterface(getContractAddress("rocketNetworkBalances"));
        uint256 totalEthBalance = rocketNetworkBalances.getTotalETHBalance();
        uint256 rethSupply = rocketNetworkBalances.getTotalRETHSupply();
        // Calculate and return
        if (totalEthBalance == 0) { return _expectedAmount; }
        return _expectedAmount.mul(rethSupply).div(totalEthBalance);
    }

}
