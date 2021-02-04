import { RocketDepositPool, RocketTokenRETH, RocketMinipoolManager, RocketDAOProtocolSettingsNetwork, RocketNetworkWithdrawal, RocketTokenNETH, RocketVault } from '../_utils/artifacts';


// Process a validator withdrawal
export async function processWithdrawal(validatorPubkey, txOptions) {

    // Load contracts
    const [
        rocketDepositPool,
        rocketTokenRETH,
        rocketMinipoolManager,
        rocketDAOProtocolSettingsNetwork,
        rocketNetworkWithdrawal,
        rocketTokenNETH,
        rocketVault,
    ] = await Promise.all([
        RocketDepositPool.deployed(),
        RocketTokenRETH.deployed(),
        RocketMinipoolManager.deployed(),
        RocketDAOProtocolSettingsNetwork.deployed(),
        RocketNetworkWithdrawal.deployed(),
        RocketTokenNETH.deployed(),
        RocketVault.deployed(),
    ]);

    // Get parameters
    let [
        minipoolAddress,
        rethCollateralRate,
        targetRethCollateralRate,
    ] = await Promise.all([
        rocketMinipoolManager.getMinipoolByPubkey.call(validatorPubkey),
        rocketTokenRETH.getCollateralRate.call(),
        rocketDAOProtocolSettingsNetwork.getTargetRethCollateralRate.call(),
    ]);

    // Get minipool details
    let [
        withdrawalTotalAmount,
        withdrawalNodeAmount,
    ] = await Promise.all([
        rocketMinipoolManager.getMinipoolWithdrawalTotalBalance.call(minipoolAddress),
        rocketMinipoolManager.getMinipoolWithdrawalNodeBalance.call(minipoolAddress),
    ]);
    let withdrawalUserAmount = withdrawalTotalAmount.sub(withdrawalNodeAmount);

    // Get balances
    function getBalances() {
        return Promise.all([
            rocketNetworkWithdrawal.getBalance.call(),
            web3.eth.getBalance(rocketVault.address).then(value => web3.utils.toBN(value)),
            web3.eth.getBalance(rocketTokenNETH.address).then(value => web3.utils.toBN(value)),
            web3.eth.getBalance(rocketTokenRETH.address).then(value => web3.utils.toBN(value)),
            rocketDepositPool.getBalance.call(),
        ]).then(
            ([withdrawalPoolEth, vaultEth, nethContractEth, rethContractEth, depositPoolEth]) =>
            ({withdrawalPoolEth, vaultEth, nethContractEth, rethContractEth, depositPoolEth})
        );
    }

    // Get initial balances & withdrawal processed status
    let [balances1, withdrawalProcessed1, unprocessedMinipoolCount1] = await Promise.all([
        getBalances(),
        rocketMinipoolManager.getMinipoolWithdrawalProcessed.call(minipoolAddress),
        rocketMinipoolManager.getUnprocessedMinipoolCount.call(),
    ]);

    // Process withdrawal
    await rocketNetworkWithdrawal.processWithdrawal(validatorPubkey, txOptions);

    // Get updated balances & withdrawal processed status
    let [balances2, withdrawalProcessed2, unprocessedMinipoolCount2] = await Promise.all([
        getBalances(),
        rocketMinipoolManager.getMinipoolWithdrawalProcessed.call(minipoolAddress),
        rocketMinipoolManager.getUnprocessedMinipoolCount.call(),
    ]);

    // Get expected user amount destination
    let expectRethDeposit = rethCollateralRate.lt(targetRethCollateralRate);

    // Check withdrawal processed status
    assert.isFalse(withdrawalProcessed1, 'Incorrect initial minipool withdrawal processed status');
    assert.isTrue(withdrawalProcessed2, 'Incorrect updated minipool withdrawal processed status');

    // Check balances
    assert(balances2.withdrawalPoolEth.eq(balances1.withdrawalPoolEth.sub(withdrawalTotalAmount)), 'Incorrect updated withdrawal pool balance');
    assert(balances2.nethContractEth.eq(balances1.nethContractEth.add(withdrawalNodeAmount)), 'Incorrect updated nETH contract balance');
    if (expectRethDeposit) {
        assert(balances2.vaultEth.eq(balances1.vaultEth.sub(withdrawalTotalAmount)), 'Incorrect updated vault balance');
        assert(balances2.rethContractEth.eq(balances1.rethContractEth.add(withdrawalUserAmount)), 'Incorrect updated rETH contract balance');
        assert(balances2.depositPoolEth.eq(balances1.depositPoolEth), 'Incorrect updated deposit pool balance');
    } else {
        assert(balances2.vaultEth.eq(balances1.vaultEth.sub(withdrawalNodeAmount)), 'Incorrect updated vault balance');
        assert(balances2.rethContractEth.eq(balances1.rethContractEth), 'Incorrect updated rETH contract balance');
        assert(balances2.depositPoolEth.eq(balances1.depositPoolEth.add(withdrawalUserAmount)), 'Incorrect updated deposit pool balance');
    }

    // Check unprocessed minipool index
    assert(unprocessedMinipoolCount2.eq(unprocessedMinipoolCount1.sub(web3.utils.toBN(1))), 'Incorrect updated unprocessed minipool count');

}

