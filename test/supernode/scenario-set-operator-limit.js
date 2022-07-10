import { RocketSupernodeDelegate } from '../_utils/artifacts';

// Set the limit for number of minipools an operator can run
export async function setOperatorLimit(supernodeAddress, operatorAddress, limit, txOptions) {
  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);

  // Perform deposit
  await supernode.setOperatorLimit(operatorAddress, limit, txOptions);

  // Record limit before
  const newLimit = await supernode.getOperatorLimit.call(operatorAddress);

  // Check new limit
  assert(newLimit.eq(web3.utils.toBN(limit)), "ETH limit was not updated");
}

