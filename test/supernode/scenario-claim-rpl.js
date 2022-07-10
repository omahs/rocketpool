import { RocketSupernodeDelegate, RocketTokenRPL } from '../_utils/artifacts';


export async function claimRpl(supernodeAddress, txOptions) {
  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);
  const rocketTokenRpl = await RocketTokenRPL.deployed();


  async function getDetails() {
    return Promise.all([
      supernode.getUnclaimedRpl.call(txOptions.from),
      rocketTokenRpl.balanceOf(txOptions.from),
    ]).then(
      ([unclaimed, balance]) =>
        ({ unclaimed, balance }),
    );
  }


  const details1 = await getDetails();
  await supernode.claimRpl(false, txOptions);
  const details2 = await getDetails();

  const balanceDiff = details2.balance.sub(details1.balance);

  // console.log('[Before]');
  // console.log('Unclaimed: ' + details1.unclaimed.toString());
  // console.log('Balance: ' + details1.balance.toString());
  // console.log('[After]');
  // console.log('Unclaimed: ' + details2.unclaimed.toString());
  // console.log('Balance: ' + details2.balance.toString());
  //
  // console.log('Diff: ' + balanceDiff.toString());

  assert(balanceDiff.eq(details1.unclaimed), 'Incorrect difference in balance');
}