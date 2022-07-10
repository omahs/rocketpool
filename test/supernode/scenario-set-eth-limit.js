import { RocketSupernodeDelegate } from '../_utils/artifacts';

// Set the limit for ETH deposits from given provider
export async function setEthLimit(supernodeAddress, providerAddress, limit, txOptions) {
  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);

  // Perform deposit
  await supernode.setEthLimit(providerAddress, limit, txOptions);

  // Record limit before
  const newLimit = await supernode.getEthLimit.call(providerAddress);

  // Check new limit
  assert(newLimit.eq(web3.utils.toBN(limit)), "ETH limit was not updated");
}

