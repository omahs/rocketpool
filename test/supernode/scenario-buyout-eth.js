import { RocketSupernodeDelegate } from '../_utils/artifacts';
import { shouldRevert } from '../_utils/testing';


export async function selloutEth(supernodeAddress, buyerAddress, amount, shouldFail, txOptions) {
  // Convert input to BN
  amount = web3.utils.toBN(amount);

  // Create the supernode instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);


  async function getProviderBalances(providerAddress) {
    return Promise.all([
      supernode.getEthShare.call(providerAddress),
      supernode.getEthLimit.call(providerAddress),
      supernode.getEthBuyoutLimit.call(providerAddress),
      supernode.getUnclaimedEth.call(providerAddress),
      web3.eth.getBalance(providerAddress),
    ]).then(
      ([share, limit, buyout, unclaimed, balance]) =>
        ({ share, limit, buyout, unclaimed, balance: web3.utils.toBN(balance) }),
    );
  }


  async function getBalances() {
    return Promise.all([
      getProviderBalances(buyerAddress),
      getProviderBalances(txOptions.from),
    ]).then(
      ([buyer, seller]) =>
        ({ buyer, seller }),
    );
  }


  function printBalances(balances) {
    console.log('[Buyer]');
    console.log('Share: ' + balances.buyer.share);
    console.log('Limit: ' + balances.buyer.limit);
    console.log('Buyout: ' + balances.buyer.buyout);
    console.log('Unclaimed: ' + balances.buyer.unclaimed);
    console.log('Balance: ' + web3.utils.fromWei(balances.buyer.balance));
    console.log('[Seller]');
    console.log('Share: ' + balances.seller.share);
    console.log('Limit: ' + balances.seller.limit);
    console.log('Buyout: ' + balances.seller.buyout);
    console.log('Unclaimed: ' + balances.seller.unclaimed);
    console.log('Balance: ' + web3.utils.fromWei(balances.seller.balance));
  }


  const balances1 = await getBalances();
  // printBalances(balances1);

  let gasUsed = web3.utils.toBN('0');

  if (balances1.buyer.share.add(amount).gt(balances1.buyer.limit)) {
    // Cannot exceed the buyer's capital limit
    await shouldRevert(supernode.selloutEth(buyerAddress, amount, txOptions), 'Buyer shares exceeded their limit', 'Exceeds buyer capital limit');
    assert(shouldFail, 'Failed unexpectedly');
    return;
  } else if (balances1.buyer.unclaimed.lt(amount)) {
    // Cannot sell to a buyer who has insufficient unclaimed rewards
    await shouldRevert(supernode.selloutEth(buyerAddress, amount, txOptions), 'Buyer had insufficient unclaimed balance', 'Not enough unclaimed ETH to sellout that amount');
    assert(shouldFail, 'Failed unexpectedly');
    return;
  } else if (balances1.buyer.buyout.lt(amount)) {
    // Cannot sell to a buyer if it exceeds their buyout limit
    await shouldRevert(supernode.selloutEth(buyerAddress, amount, txOptions), 'Buyer had insufficient buyout limit', 'Buyer buyout limit is too low');
    assert(shouldFail, 'Failed unexpectedly');
    return;
  } else {
    const tx = await supernode.selloutEth(buyerAddress, amount, txOptions);
    gasUsed = web3.utils.toBN(tx.receipt.gasUsed).mul(web3.utils.toBN(tx.receipt.effectiveGasPrice));
    assert(!shouldFail, 'Succeeded unexpectedly');
  }

  const balances2 = await getBalances();
  // printBalances(balances2);

  // Check results
  assert(balances2.buyer.share.eq(balances1.buyer.share.add(amount)), 'Incorrect change in buyer share');
  assert(balances2.seller.share.eq(balances1.seller.share.sub(amount)), 'Incorrect change in seller share');
  assert(balances2.buyer.buyout.eq(balances1.buyer.buyout.sub(amount)), 'Incorrect change in buyer buyout limit');
  assert(balances2.buyer.unclaimed.eq(balances1.buyer.unclaimed.sub(amount)), 'Incorrect change in buyer unclaimed rewards');
  assert(balances2.buyer.balance.eq(balances1.buyer.balance), 'Incorrect change in buyer balance');
  assert(balances2.seller.balance.eq(balances1.seller.balance.add(amount).add(balances1.seller.unclaimed).sub(gasUsed)), 'Incorrect change in seller balance');
}

