import { RocketNodeDistributorFactory, RocketNodeManager, RocketSupernodeDelegate } from '../_utils/artifacts';


export async function distributeRpl(supernodeAddress, txOptions) {
  // Get contracts
  const rocketNodeDistributor = await RocketNodeDistributorFactory.deployed();
  const rocketNodeManager = await RocketNodeManager.deployed();

  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);
  const distributor = await rocketNodeDistributor.getProxyAddress(supernodeAddress);

  const calcBase = web3.utils.toBN(web3.utils.toWei('1', 'ether'));


  async function getActors() {
    const count = await supernode.getActorCount();
    const promises = [...Array(count.toNumber()).keys()].map(i => supernode.getActorAt(i));
    return Promise.all(promises);
  }


  async function getBalances(providerAddress) {
    return Promise.all([
      supernode.getRplShare.call(providerAddress),
      supernode.getUnclaimedRpl.call(providerAddress),
      supernode.getOperatorCount.call(providerAddress),
    ]).then(
      ([share, unclaimed, minipoolCount]) =>
        ({ share, unclaimed, minipoolCount }),
    );
  }


  async function getAllBalances(actors) {
    return Promise.all(actors.map(actor => getBalances(actor)));
  }


  function printBalances(actors, balances) {
    for (let i = 0; i < actors.length; i++) {
      console.log(actors[i]);
      console.log('Shares: ' + balances[i].share.toString());
      console.log('Minipools: ' + balances[i].minipoolCount.toString());
      console.log('Unclaimed: ' + balances[i].unclaimed.toString());
    }
  }


  const supernodeOperator = await supernode.getOwner();
  const actors = await getActors();
  // Add supernode operator as an actor to check their balance
  if (!actors.includes(supernodeAddress)) {
    actors.push(supernodeOperator);
  }

  const fees = await supernode.getFees();
  const supernodeFee = fees.supernodeRplFee_;
  const nodeOperatorFee = fees.nodeOperatorRplFee_;

  const totalShares = await supernode.getTotalRplShares();
  const totalMinipools = await supernode.getMinipoolCount();

  const halfDistributorBalance = web3.utils.toBN(await web3.eth.getBalance(distributor)).div(web3.utils.toBN('2'));
  const distributorNodeFee = await rocketNodeManager.getAverageNodeFee(supernodeAddress);
  const totalUnclaimed = halfDistributorBalance.add(halfDistributorBalance.mul(distributorNodeFee).div(calcBase));

  // Distribute the RPL rewards
  const balances1 = await getAllBalances(actors);
  await supernode.distributeRpl();
  const balances2 = await getAllBalances(actors);

  // console.log('Total shares: ' + totalShares.toString());
  // console.log('Total unclaimed: ' + totalUnclaimed.toString());
  // console.log('Supernode fee %: ' + web3.utils.fromWei(supernodeFee));
  // console.log('Node Operator fee %: ' + web3.utils.fromWei(nodeOperatorFee));
  //
  // console.log('[Before]');
  // printBalances(actors, balances1);
  // console.log('[After]');
  // printBalances(actors, balances2);

  const toSupernodeOperator = totalUnclaimed.mul(supernodeFee).div(calcBase);
  let toNodeOperators, perMinipool, toProviders;

  if (totalMinipools.gt(web3.utils.toBN('0'))){
    toNodeOperators = totalUnclaimed.mul(nodeOperatorFee).div(calcBase);
    perMinipool = toNodeOperators.div(totalMinipools);
    toProviders = totalUnclaimed.sub(toSupernodeOperator).sub(toNodeOperators);
  } else {
    toNodeOperators = web3.utils.toBN('0');
    perMinipool = web3.utils.toBN('0');
    toProviders = totalUnclaimed.sub(toSupernodeOperator);
  }

  // console.log('To supernode operator: ' + toSupernodeOperator.toString());
  // console.log('To node operators: ' + toNodeOperators.toString());
  // console.log('To providers: ' + toProviders.toString());
  //
  // console.log('Unclaimed per share: ' + await supernode.unclaimedRplPerShare());

  for (let i = 0; i < actors.length; i++) {
    const balanceDelta = balances2[i].unclaimed.sub(balances1[i].unclaimed);
    let expectedDelta = balances1[i].share.mul(toProviders).div(totalShares);

    if (actors[i] === supernodeOperator) {
      expectedDelta = expectedDelta.add(toSupernodeOperator);
    }

    if (balances1[i].minipoolCount.gt(0)) {
      expectedDelta = expectedDelta.add(perMinipool.mul(balances1[i].minipoolCount));
    }

    // console.log(actors[i] + ' expected ' + expectedDelta.toString() + ' got ' + balanceDelta.toString());
  }

}

