pragma solidity 0.7.6;

// SPDX-License-Identifier: GPL-3.0-only

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./RocketSupernodeStorageLayout.sol";
import "../../interface/node/RocketNodeManagerInterface.sol";
import "../../interface/node/RocketNodeDistributorFactoryInterface.sol";
import "../../interface/node/RocketNodeDistributorInterface.sol";
import "../../interface/node/RocketNodeDepositInterface.sol";
import "../../interface/node/RocketNodeStakingInterface.sol";
import "../../interface/minipool/RocketMinipoolInterface.sol";
import "../../interface/util/AddressSetStorageInterface.sol";
import "../../interface/token/RocketTokenRPLInterface.sol";

contract RocketSupernodeDelegate is RocketSupernodeStorageLayout {

    uint256 constant unclaimedBase = 1 ether;    // Unclaimed per share values are stored in higher precision using this base
    uint256 constant shareBase = 1 gwei;         // Share balances are stored as a multiple of this base
    uint256 constant feeBase = 1 ether;         // Fee percentages are stored in this precision

    using SafeMath for uint256;

    /// @dev Get the address of a network contract by name
    function getContractAddress(string memory _contractName) internal view returns (address) {
        // Get the current contract address
        address contractAddress = rocketStorage.getAddress(keccak256(abi.encodePacked("contract.address", _contractName)));
        // Check it
        require(contractAddress != address(0x0), "Contract not found");
        // Return
        return contractAddress;
    }

    /**
    * @dev Throws if called by any sender that doesn't match one of the supplied contract or is the latest version of that contract
    */
    modifier onlyLatestContract(string memory _contractName, address _contractAddress) {
        require(_contractAddress == getContractAddress(_contractName), "Invalid or outdated contract");
        _;
    }

    // Only the owner of this supernode can call these functions
    modifier onlySupernodeOwner {
        require(msg.sender == ownerAddress, "Only owner");
        _;
    }

    function getOwner() external view returns (address) {
        return ownerAddress;
    }

    // Registers this supernode as a node operator with Rocket Pool
    function register(string memory _timezoneLocation) external onlyLatestContract("rocketSupernodeManager", msg.sender) {
        // Get contracts
        RocketNodeManagerInterface rocketNodeManager = RocketNodeManagerInterface(getContractAddress("rocketNodeManager"));
        // Register
        rocketNodeManager.registerNode(_timezoneLocation);
    }

    // Performs a deposit (creating a minipool)
    function deposit(address _nodeOperator, bytes calldata _validatorPubkey, bytes calldata _validatorSignature, bytes32 _depositDataRoot, uint256 _salt, address _expectedMinipoolAddress) external payable onlyLatestContract("rocketSupernodeManager", address(msg.sender)) {
        // Validate limit
        OperatorData memory operator = operators[_nodeOperator];
        // TODO: SafeMath these uint128s
        require(operator.limit > operator.count, "Exceeds limit");
        // Distribute rewards and increment active minipool count
        distributeRewards();
        totalMinipoolCount = totalMinipoolCount.add(1);
        // TODO: SafeMath this uint128
        operators[_nodeOperator].count = operators[_nodeOperator].count + 1;
        operators[_nodeOperator].paidEth = operators[_nodeOperator].paidEth.add(nodeOperatorUnclaimedEthPerMinipool);
        operators[_nodeOperator].paidRpl = operators[_nodeOperator].paidRpl.add(nodeOperatorUnclaimedRplPerMinipool);
        // Perform the deposit
        RocketNodeDepositInterface rocketNodeDeposit = RocketNodeDepositInterface(getContractAddress("rocketNodeDeposit"));
        rocketNodeDeposit.deposit{value : 16 ether}(minimumNodeFee, _validatorPubkey, _validatorSignature, _depositDataRoot, _salt, _expectedMinipoolAddress);
    }

    // Adds an actor to the set of actors associated with this supernode
    function addActor(address _actor) internal {
        if (!actorExists[_actor]) {
            actors.push(_actor);
            actorExists[_actor] = true;
        }
    }

    // Retrieves the nth actor address for this supernode
    function getActorAt(uint256 _index) external view returns (address) {
        return actors[_index];
    }

    // Retrieves the count of actors for this supernode
    function getActorCount() external view returns (uint256) {
        return actors.length;
    }

    // Retreives the total number of ETH shares
    function getTotalEthShares() external view returns (uint256) {
        return uint256(totalEthShares).mul(shareBase);
    }

    // Retreives the total number of RPL shares
    function getTotalRplShares() external view returns (uint256) {
        return uint256(totalRplShares).mul(shareBase);
    }

    // Retrieves the total number of active minipools
    function getMinipoolCount() external view returns (uint256) {
        return totalMinipoolCount;
    }

    function setFees(uint64 _supernodeEthFee, uint64 _supernodeRplFee, uint64 _nodeOperatorEthFee, uint64 _nodeOperatorRplFee) external onlySupernodeOwner {
        // Check inputs
        require(_supernodeEthFee <= feeBase, "Invalid supernode ETH fee");
        require(_supernodeRplFee <= feeBase, "Invalid supernode RPL fee");
        require(_nodeOperatorEthFee <= feeBase, "Invalid node operator ETH fee");
        require(_nodeOperatorRplFee <= feeBase, "Invalid node operator RPL fee");
        // Distribute rewards with previous fee
        distributeRewards();
        // Update fees
        supernodeEthFee = _supernodeEthFee;
        supernodeRplFee = _supernodeRplFee;
        nodeOperatorEthFee = _nodeOperatorEthFee;
        nodeOperatorRplFee = _nodeOperatorRplFee;
    }

    // Retrieves the fee set
    function getFees() external view returns (uint64 supernodeEthFee_, uint64 supernodeRplFee_, uint64 nodeOperatorEthFee_, uint64 nodeOperatorRplFee_) {
        return (
        supernodeEthFee,
        supernodeRplFee,
        nodeOperatorEthFee,
        nodeOperatorRplFee
        );
    }

    // Sets the limit of how many minipools a given operator can create
    function setOperatorLimit(address _operator, uint128 _newLimit) external onlySupernodeOwner {
        operators[_operator].limit = _newLimit;
        addActor(_operator);
    }

    // Retrieves the limit of how many minipools a given operator can create
    function getOperatorLimit(address _operator) external view returns (uint128) {
        return operators[_operator].limit;
    }

    // Retrieves the number of minipools an operator currently has active
    function getOperatorCount(address _operator) external view returns (uint128) {
        return operators[_operator].count;
    }

    // Retrieves the number of active minipools and operator is running
    function getOperatorMinipoolCount(address _operator) external view returns (uint128) {
        return operators[_operator].count;
    }

    // Sets a limit to the amount of ETH a capital provider can deposit
    function setEthLimit(address _provider, uint256 _newLimit) external onlySupernodeOwner {
        ethProviders[_provider].limit = uint128(_newLimit.div(shareBase));
        addActor(_provider);
    }

    // Sets the amount of ETH position a provider is willing to buy from other providers
    function setEthBuyoutLimit(uint256 _newLimit) external {
        ethProviders[msg.sender].buyout = _newLimit;
    }

    // Retrieves the current ETH deposit limit for a given provider
    function getEthLimit(address _provider) external view returns (uint256) {
        return uint256(ethProviders[_provider].limit).mul(shareBase);
    }

    // Retrieves the current ETH buyout limit for a given provider
    function getEthBuyoutLimit(address _provider) external view returns (uint256) {
        return ethProviders[_provider].buyout;
    }

    // Retrieves the current amount of ETH shares the given provider owns
    function getEthShare(address _provider) external view returns (uint256) {
        return uint256(ethProviders[_provider].share).mul(shareBase);
    }

    // Calculates how much ETH is owing to the given actor
    function getUnclaimedEth(address _actor) public view returns (uint256) {
        (uint256 supernodeEth, uint256 nodeOperatorEth, uint256 providerEth) = _getUnclaimedEth(_actor);
        return supernodeEth.add(nodeOperatorEth).add(providerEth);
    }

    function _getUnclaimedEth(address _actor) private view returns (uint256, uint256, uint256) {
        // Supernode operator rewards
        uint256 supernodeEth = 0;
        if (_actor == ownerAddress) {
            supernodeEth = supernodeUnclaimedEth;
        }
        // Node operator rewards
        uint256 nodeOperatorEth = 0;
        OperatorData memory operator = operators[_actor];
        nodeOperatorEth = uint256(operator.count).mul(nodeOperatorUnclaimedEthPerMinipool).sub(operator.paidEth);
        // Provider rewards
        ProviderData memory balance = ethProviders[_actor];
        uint256 providerEth = uint256(balance.share).mul(unclaimedEthPerShare).div(unclaimedBase).sub(balance.paid);
        // Return
        return (supernodeEth, nodeOperatorEth, providerEth);
    }

    // Sets a limit to the amount of RPL a capital provider can deposit
    function setRplLimit(address _provider, uint256 _newLimit) external onlySupernodeOwner {
        rplProviders[_provider].limit = uint128(_newLimit.div(shareBase));
        addActor(_provider);
    }

    // Sets the amount of RPL position a provider is willing to buy from other providers
    function setRplBuyoutLimit(uint256 _newLimit) external {
        rplProviders[msg.sender].buyout = _newLimit;
    }

    // Retrieves the current RPL deposit limit for a given provider
    function getRplLimit(address _provider) external view returns (uint256) {
        return uint256(rplProviders[_provider].limit).mul(shareBase);
    }

    // Retrieves the current RPL buyout limit for a given provider
    function getRplBuyoutLimit(address _provider) external view returns (uint256) {
        return rplProviders[_provider].buyout;
    }

    // Retrieves the current amount of RPL shares the given provider owns
    function getRplShare(address _provider) external view returns (uint256) {
        return uint256(rplProviders[_provider].share).mul(shareBase);
    }

    // Calculates how much RPL is owing to the given actor
    function getUnclaimedRpl(address _actor) public view returns (uint256) {
        (uint256 supernodeRpl, uint256 nodeOperatorRpl, uint256 providerRpl) = _getUnclaimedRpl(_actor);
        return supernodeRpl.add(nodeOperatorRpl).add(providerRpl);
    }

    function _getUnclaimedRpl(address _actor) private view returns (uint256, uint256, uint256) {
        // Supernode operator rewards
        uint256 supernodeRpl = 0;
        if (_actor == ownerAddress) {
            supernodeRpl = supernodeUnclaimedRpl;
        }
        // Node operator rewards
        uint256 nodeOperatorRpl = 0;
        OperatorData memory operator = operators[_actor];
        nodeOperatorRpl = uint256(operator.count).mul(nodeOperatorUnclaimedRplPerMinipool).sub(operator.paidRpl);
        // Provider rewards
        ProviderData memory balance = rplProviders[_actor];
        uint256 providerRpl = uint256(balance.share).mul(unclaimedRplPerShare).div(unclaimedBase).sub(balance.paid);
        // Return
        return (supernodeRpl, nodeOperatorRpl, providerRpl);
    }

    // Distributes both ETH and RPL rewards
    function distributeRewards() public {
        distributeEth();
    }

    // Distributes priority fees and performs distribution accounting
    function distributeEth() public {
        // Get contracts
        RocketNodeDistributorFactoryInterface rocketNodeDistributor = RocketNodeDistributorFactoryInterface(getContractAddress("rocketNodeDistributorFactory"));
        RocketNodeDistributorInterface distributor = RocketNodeDistributorInterface(rocketNodeDistributor.getProxyAddress(address(this)));
        // Record prior balance
        uint256 priorBalance = address(this).balance;
        // Perform distribution
        distributor.distribute();
        // Calculate difference in balance
        uint256 ethToDistribute = address(this).balance.sub(priorBalance);
        if (ethToDistribute > 0) {
            // Calculate and apply supernode fee
            uint256 supernodeFee = ethToDistribute.mul(supernodeEthFee).div(feeBase);
            supernodeUnclaimedEth = supernodeUnclaimedEth.add(supernodeFee);
            // Calculate and apply node operator fee
            uint256 nodeOperatorFee = ethToDistribute.mul(nodeOperatorEthFee).div(feeBase);
            uint256 perMinipool = 0;
            if (totalMinipoolCount > 0) {
                perMinipool = nodeOperatorFee.div(totalMinipoolCount);
            }
            nodeOperatorUnclaimedEthPerMinipool = nodeOperatorUnclaimedEthPerMinipool.add(perMinipool);
            // TODO: Handle dust?
            ethToDistribute = ethToDistribute.sub(supernodeFee).sub(perMinipool.mul(totalMinipoolCount));
            // Calculate per share to distribute
            uint256 perShare = ethToDistribute.mul(unclaimedBase).div(uint256(totalEthShares));
            unclaimedEthPerShare = unclaimedEthPerShare.add(perShare);
            // TODO: Handle dust?
        }
    }

    // Distributes any RPL rewards that have been claimed and accrued in this contract
    function distributeRpl() public {
        // Get contracts
        RocketTokenRPLInterface rocketTokenRPL = RocketTokenRPLInterface(getContractAddress("rocketTokenRPL"));
        // Calculate RPL increase since last distribution
        uint256 balance = rocketTokenRPL.balanceOf(address(this));
        uint256 rplToDistribute = balance.sub(unclaimedRpl);
        if (rplToDistribute > 0) {
            // Calculate fees
            uint256 supernodeFee = rplToDistribute.mul(supernodeRplFee).div(feeBase);
            supernodeUnclaimedRpl = supernodeUnclaimedRpl.add(supernodeFee);
            uint256 nodeOperatorFee = rplToDistribute.mul(nodeOperatorRplFee).div(feeBase);
            uint256 perMinipool;
            if (totalMinipoolCount > 0) {
                perMinipool = nodeOperatorFee.div(totalMinipoolCount);
            }
            nodeOperatorUnclaimedRplPerMinipool = nodeOperatorUnclaimedRplPerMinipool.add(perMinipool);
            // Calculate per share to distribute
            rplToDistribute = rplToDistribute.sub(supernodeFee).sub(perMinipool.mul(totalMinipoolCount));
            uint256 perShare = rplToDistribute.mul(unclaimedBase).div(totalRplShares);
            // Increase unclaimed amount per share
            unclaimedRplPerShare = unclaimedRplPerShare.add(perShare);
            // Increase unclaimed amount by total amount that was distributed
            unclaimedRpl = unclaimedRpl.add(perShare.mul(totalRplShares).div(unclaimedBase)).add(supernodeFee).add(perMinipool.mul(totalMinipoolCount));
        }
    }

    function finaliseMinipool(address _minipoolAddress) external onlySupernodeOwner {
        RocketMinipoolInterface minipool = RocketMinipoolInterface(_minipoolAddress);
        address nodeOperator = minipool.getNodeAddress();
        // Record prior balance
        uint256 priorBalance = address(this).balance;
        // Distribute and finalise
        minipool.distributeBalanceAndFinalise();
        // Calculate difference in balance
        uint256 ethToDistribute = address(this).balance.sub(priorBalance);
        if (ethToDistribute > 0) {
            uint256 perShare = ethToDistribute.div(totalEthShares);
            // Increase unclaimed amount
            unclaimedEthPerShare = unclaimedEthPerShare.add(perShare);
            // TODO: Handle dust?
        }
        // Distribute rewards and decrement minipool count
        distributeRewards();
        totalMinipoolCount = totalMinipoolCount.sub(1);
        // TODO: SafeMath this uint128
        operators[nodeOperator].count = operators[nodeOperator].count - 1;
        operators[nodeOperator].paidEth = operators[nodeOperator].paidEth.sub(nodeOperatorUnclaimedEthPerMinipool);
        operators[nodeOperator].paidRpl = operators[nodeOperator].paidRpl.sub(nodeOperatorUnclaimedRplPerMinipool);
    }

    function selloutEth(address _buyerAddress, uint256 _amount) external {
        // Perform distribution and claim before the sellout
        distributeEth();
        _claimEth(msg.sender);
        // Get data from storage
        ProviderData memory seller = ethProviders[msg.sender];
        ProviderData memory buyer = ethProviders[_buyerAddress];
        // Check limits
        uint128 numShares = uint128(_amount.div(shareBase));
        require(_amount <= buyer.buyout, "Buyer buyout limit is too low");
        require(buyer.limit >= uint256(buyer.share).add(numShares), "Exceeds buyer capital limit");
        // Calculate where to take the rewards from
        (uint256 supernodeEth, uint256 nodeOperatorEth, uint256 providerEth) = _getUnclaimedEth(_buyerAddress);
        // From supernode rewards
        uint256 runningAmount = _amount;
        uint256 fromSupernodeEth = runningAmount;
        if (runningAmount > supernodeEth) {
            fromSupernodeEth = supernodeEth;
            runningAmount -= supernodeEth;
        } else {
            runningAmount = 0;
        }
        // From node operator rewards
        uint256 fromNodeOperatorEth = runningAmount;
        if (runningAmount > nodeOperatorEth) {
            fromNodeOperatorEth = nodeOperatorEth;
            runningAmount -= nodeOperatorEth;
        } else {
            runningAmount = 0;
        }
        // Anything left from provider rewards
        uint256 fromProviderEth = runningAmount;
        if (runningAmount > providerEth) {
            revert("Not enough unclaimed ETH to sellout that amount");
        }
        // Perform accounting
        supernodeUnclaimedEth = supernodeUnclaimedEth.sub(fromSupernodeEth);
        operators[_buyerAddress].paidEth = operators[_buyerAddress].paidEth.add(fromNodeOperatorEth);
        buyer.buyout = buyer.buyout.sub(_amount);
        uint256 paidDelta = uint256(numShares).mul(unclaimedEthPerShare).div(unclaimedBase);
        buyer.paid = buyer.paid.add(paidDelta).add(fromProviderEth);
        seller.paid = seller.paid.sub(paidDelta);
        // TODO: SafeMath these uint128s
        buyer.share = buyer.share + numShares;
        seller.share = seller.share - numShares;
        // Store results
        ethProviders[msg.sender] = seller;
        ethProviders[_buyerAddress] = buyer;
        // Send ETH
        (bool success,) = msg.sender.call{value : _amount}("");
        require(success, "Withdraw failed");
    }

    // Increases a capital providers number of shares by depositing ETH
    function depositEth() external payable {
        // Value must be non-zero and an integer division of 1 gwei
        require(msg.value > 0 && msg.value % shareBase == 0, "Invalid amount");
        // Shares are stored in 1e9
        uint128 numShares = uint128(msg.value.div(shareBase));
        ProviderData memory balance = ethProviders[msg.sender];
        // Can't exceed limit set by SNO
        require(balance.limit >= uint256(balance.share).add(numShares), "Exceeds capital limit");
        // Perform accounting
        balance.share = uint128(uint256(balance.share).add(numShares));
        balance.paid = balance.paid.add(uint256(numShares).mul(unclaimedEthPerShare).div(unclaimedBase));
        // TODO: SafeMath these uint128s
        totalEthShares = totalEthShares + numShares;
        // Store result
        ethProviders[msg.sender] = balance;
    }

    // Withdraws distributed ETH, optionally distributing first
    function claimEth(bool _distribute) external {
        // Optionally, distribute
        if (_distribute) {
            distributeEth();
        }
        _claimEth(msg.sender);
    }

    function _claimEth(address _actor) private {
        // Calculate unclaimed rewards
        (uint256 supernodeEth, uint256 nodeOperatorEth, uint256 providerEth) = _getUnclaimedEth(_actor);
        // Perform accounting
        if (supernodeEth > 0) {
            supernodeUnclaimedEth = 0;
        }
        operators[_actor].paidEth = operators[_actor].paidEth.add(nodeOperatorEth);
        ethProviders[_actor].paid = ethProviders[_actor].paid.add(providerEth);
        // Total
        uint256 total = supernodeEth.add(nodeOperatorEth).add(providerEth);
        // Attempt to transfer the ETH
        (bool success,) = _actor.call{value : total}("");
        require(success, "Transfer failed");
    }

    function selloutRpl(address _buyerAddress, uint256 _amount) external {
        // Get contracts
        RocketTokenRPLInterface rocketTokenRPL = RocketTokenRPLInterface(getContractAddress("rocketTokenRPL"));
        // Perform distribution and claim before the sellout
        distributeRpl();
        _claimRpl(msg.sender);
        // Get data from storage
        ProviderData memory seller = rplProviders[msg.sender];
        ProviderData memory buyer = rplProviders[_buyerAddress];
        // Check limits
        uint128 numShares = uint128(_amount.div(shareBase));
        require(_amount <= buyer.buyout, "Buyer buyout limit is too low");
        require(buyer.limit >= uint256(buyer.share).add(numShares), "Exceeds buyer capital limit");
        // Calculate where to take the rewards from
        uint256 fromSupernodeRpl;
        uint256 fromNodeOperatorRpl;
        uint256 fromProviderRpl;
        {
            (uint256 supernodeRpl, uint256 nodeOperatorRpl, uint256 providerRpl) = _getUnclaimedRpl(_buyerAddress);
            // From supernode rewards
            uint256 runningAmount = _amount;
            fromSupernodeRpl = runningAmount;
            if (runningAmount > supernodeRpl) {
                fromSupernodeRpl = supernodeRpl;
                runningAmount -= supernodeRpl;
            } else {
                runningAmount = 0;
            }
            // From node operator rewards
            fromNodeOperatorRpl = runningAmount;
            if (runningAmount > nodeOperatorRpl) {
                fromNodeOperatorRpl = nodeOperatorRpl;
                runningAmount -= nodeOperatorRpl;
            } else {
                runningAmount = 0;
            }
            // Anything left from provider rewards
            fromProviderRpl = runningAmount;
            if (runningAmount > providerRpl) {
                revert("Not enough unclaimed RPL to sellout that amount");
            }
        }
        // Perform accounting
        supernodeUnclaimedRpl = supernodeUnclaimedRpl.sub(fromSupernodeRpl);
        operators[_buyerAddress].paidRpl = operators[_buyerAddress].paidRpl.add(fromNodeOperatorRpl);
        buyer.buyout = buyer.buyout.sub(_amount);
        uint256 paidDelta = uint256(numShares).mul(unclaimedRplPerShare).div(unclaimedBase);
        buyer.paid = buyer.paid.add(paidDelta).add(fromProviderRpl);
        seller.paid = seller.paid.sub(paidDelta);
        // TODO: SafeMath these uint128s
        buyer.share = buyer.share + numShares;
        seller.share = seller.share - numShares;
        // Store results
        rplProviders[msg.sender] = seller;
        rplProviders[_buyerAddress] = buyer;
        // Send RPL
        rocketTokenRPL.transfer(msg.sender, _amount);
        unclaimedRpl = unclaimedRpl.sub(_amount);
    }

    // Increases a capital providers number of shares by depositing RPL
    function depositRpl(uint256 _amount) external {
        // Value must be non-zero and an integer division of 1 gwei
        require(_amount > 0 && _amount % shareBase == 0, "Invalid amount");
        // Check limit
        uint128 numShares = uint128(_amount.div(shareBase));
        ProviderData memory balance = rplProviders[msg.sender];
        require(balance.limit >= uint256(balance.share).add(uint256(numShares)), "Exceeds capital limit");
        // Perform accounting
        balance.share = uint128(uint256(balance.share).add(uint256(numShares)));
        balance.paid = balance.paid.add(uint256(numShares).mul(unclaimedRplPerShare).div(unclaimedBase));
        // TODO: SafeMath this uint128
        totalRplShares = totalRplShares + numShares;
        // Store result
        rplProviders[msg.sender] = balance;
        // Transfer the RPL
        IERC20 rplToken = IERC20(getContractAddress("rocketTokenRPL"));
        rplToken.transferFrom(msg.sender, address(this), _amount);
        // Stake the RPL
        RocketNodeStakingInterface rocketNodeStaking = RocketNodeStakingInterface(getContractAddress("rocketNodeStaking"));
        rplToken.approve(address(rocketNodeStaking), _amount);
        rocketNodeStaking.stakeRPL(_amount);
    }

    // Withdraws distributed RPL, optionally distributing first
    function claimRpl(bool _distribute) external {
        // Optionally, distribute
        if (_distribute) {
            distributeRpl();
        }
        _claimRpl(msg.sender);
    }

    function _claimRpl(address _actor) private {
        // Get contracts
        RocketTokenRPLInterface rocketTokenRPL = RocketTokenRPLInterface(getContractAddress("rocketTokenRPL"));
        // Calculate unclaimed rewards
        (uint256 supernodeRpl, uint256 nodeOperatorRpl, uint256 providerRpl) = _getUnclaimedRpl(_actor);
        // Perform accounting
        if (supernodeRpl > 0) {
            supernodeUnclaimedRpl = 0;
        }
        operators[_actor].paidRpl = operators[_actor].paidRpl.add(nodeOperatorRpl);
        rplProviders[_actor].paid = rplProviders[_actor].paid.add(providerRpl);
        // Total
        uint256 total = supernodeRpl.add(nodeOperatorRpl).add(providerRpl);
        unclaimedRpl = unclaimedRpl.sub(total);
        // Attempt to transfer the RPL
        rocketTokenRPL.transfer(_actor, total);
    }
}