import { RocketSupernodeDelegate } from '../_utils/artifacts';


export async function claimEth(supernodeAddress, txOptions) {
  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);

  async function getDetails() {
    return Promise.all([
      supernode.getUnclaimedEth.call(txOptions.from),
      web3.eth.getBalance(txOptions.from)
    ]).then(
      ([unclaimed, balance]) =>
        ({unclaimed, balance: web3.utils.toBN(balance)})
    );
  }

  const details1 = await getDetails();
  const tx = await supernode.claimEth(false, txOptions);
  const details2 = await getDetails();

  const gasUsed = web3.utils.toBN(tx.receipt.gasUsed).mul(web3.utils.toBN(tx.receipt.effectiveGasPrice));
  const balanceDiff = details2.balance.add(gasUsed).sub(details1.balance);

  assert(balanceDiff.eq(details1.unclaimed), "Incorrect difference in balance");

  // console.log('[Before]');
  // console.log('Unclaimed: ' + details1.unclaimed.toString());
  // console.log('Balance: ' + details1.balance.toString());
  // console.log('[After]');
  // console.log('Unclaimed: ' + details2.unclaimed.toString());
  // console.log('Balance: ' + details2.balance.toString());
  //
  // console.log('Diff: ' + balanceDiff.toString());
}