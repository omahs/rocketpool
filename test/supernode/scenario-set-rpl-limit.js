import { RocketSupernodeDelegate } from '../_utils/artifacts';

// Set the limit for RPL deposits from given provider
export async function setRplLimit(supernodeAddress, providerAddress, limit, txOptions) {
  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);

  // Perform deposit
  await supernode.setRplLimit(providerAddress, limit, txOptions);

  // Record limit before
  const newLimit = await supernode.getRplLimit.call(providerAddress);

  // Check new limit
  assert(newLimit.eq(web3.utils.toBN(limit)), "RPL limit was not updated");
}

