import { RocketETHToken } from '../_utils/artifacts';


// Burn rETH for ETH
export async function burnReth(amount, txOptions) {

    // Load contracts
    const rocketETHToken = await RocketETHToken.deployed();

    // Get balances
    function getBalances() {
        return Promise.all([
            rocketETHToken.totalSupply.call(),
            web3.eth.getBalance(rocketETHToken.address).then(value => web3.utils.toBN(value)),
            rocketETHToken.balanceOf.call(txOptions.from),
            web3.eth.getBalance(txOptions.from).then(value => web3.utils.toBN(value)),
        ]).then(
            ([tokenSupply, tokenEthBalance, userTokenBalance, userEthBalance]) =>
            ({tokenSupply, tokenEthBalance, userTokenBalance, userEthBalance})
        );
    }

    // Get initial balances
    let balances1 = await getBalances();

    // Set gas price
    let gasPrice = web3.utils.toBN(web3.utils.toWei('20', 'gwei'));
    txOptions.gasPrice = gasPrice;

    // Burn tokens & get tx fee
    let txReceipt = await rocketETHToken.burn(amount, txOptions);
    let txFee = gasPrice.mul(web3.utils.toBN(txReceipt.receipt.gasUsed));

    // Get updated balances
    let balances2 = await getBalances();

    // Get values
    let wei = web3.utils.toBN(1);
    let burnAmount = web3.utils.toBN(amount);
    let expectedTokenEth = balances1.tokenEthBalance.sub(burnAmount);
    let expectedUserEth = balances1.userEthBalance.add(burnAmount).sub(txFee);

    // Check balances
    assert(balances2.tokenSupply.eq(balances1.tokenSupply.sub(burnAmount)), 'Incorrect updated token supply');
    assert(balances2.tokenEthBalance.sub(expectedTokenEth).abs().lte(wei), 'Incorrect updated token ETH balance'); // Allow rounding errors of 1 wei
    assert(balances2.userTokenBalance.eq(balances1.userTokenBalance.sub(burnAmount)), 'Incorrect updated user token balance');
    assert(balances2.userEthBalance.sub(expectedUserEth).abs().lte(wei), 'Incorrect updated user ETH balance'); // Allow rounding errors of 1 wei

}

