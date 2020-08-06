import { RocketDepositPool, RocketETHToken, RocketVault } from '../_utils/artifacts';


// Make a deposit into the deposit pool
export async function deposit(txOptions) {

    // Load contracts
    const [
        rocketDepositPool,
        rocketETHToken,
        rocketVault,
    ] = await Promise.all([
        RocketDepositPool.deployed(),
        RocketETHToken.deployed(),
        RocketVault.deployed(),
    ]);

    // Get balances
    function getBalances() {
        return Promise.all([
            rocketDepositPool.getBalance.call(),
            web3.eth.getBalance(rocketVault.address).then(value => web3.utils.toBN(value)),
            rocketETHToken.balanceOf.call(txOptions.from),
        ]).then(
            ([depositPoolEth, vaultEth, userReth]) =>
            ({depositPoolEth, vaultEth, userReth})
        );
    }

    // Get initial balances
    let balances1 = await getBalances();

    // Deposit
    await rocketDepositPool.deposit(txOptions);

    // Get updated balances
    let balances2 = await getBalances();

    // Get values
    let wei = web3.utils.toBN(1);
    let txValue = web3.utils.toBN(txOptions.value);
    let expectedUserReth = balances1.userReth.add(txValue);

    // Check balances
    assert(balances2.depositPoolEth.eq(balances1.depositPoolEth.add(txValue)), 'Incorrect updated deposit pool ETH balance');
    assert(balances2.vaultEth.eq(balances1.vaultEth.add(txValue)), 'Incorrect updated vault ETH balance');
    assert(balances2.userReth.sub(expectedUserReth).abs().lte(wei), 'Incorrect updated user rETH balance'); // Allow rounding errors of 1 wei

}

