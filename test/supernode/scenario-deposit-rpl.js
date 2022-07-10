import {
  RocketDAOProtocolSettingsMinipool, RocketDAOProtocolSettingsNode,
  RocketMinipoolManager,
  RocketNetworkPrices, RocketNodeStaking,
  RocketSupernodeDelegate, RocketTokenRPL, RocketVault,
} from '../_utils/artifacts';
import { shouldRevert } from '../_utils/testing';

// Deposit ETH into a supernode
export async function depositRpl(supernodeAddress, amount, txOptions) {
  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);

  // Load contracts
  const [
    rocketNodeStaking,
    rocketTokenRPL,
    rocketVault,
  ] = await Promise.all([
    RocketNodeStaking.deployed(),
    RocketTokenRPL.deployed(),
    RocketVault.deployed(),
  ]);

  async function getDetails(providerAddress) {
    return Promise.all([
      supernode.getRplLimit.call(providerAddress),
      supernode.getRplShare.call(providerAddress),
    ]).then(
      ([limit, share]) =>
        ({limit, share})
    );
  }

  // Get token balances
  function getTokenBalances() {
    return Promise.all([
      rocketTokenRPL.balanceOf.call(rocketVault.address),
      rocketVault.balanceOfToken.call('rocketNodeStaking', rocketTokenRPL.address),
    ]).then(
      ([vaultRpl, stakingRpl]) =>
        ({vaultRpl, stakingRpl})
    );
  }

  // Get staking details
  function getStakingDetails(nodeAddress) {
    return Promise.all([
      rocketNodeStaking.getTotalRPLStake.call(),
      rocketNodeStaking.getTotalEffectiveRPLStake.call(),
      rocketNodeStaking.getNodeRPLStake.call(nodeAddress),
      rocketNodeStaking.getNodeEffectiveRPLStake.call(nodeAddress),
      rocketNodeStaking.getNodeMinipoolLimit.call(nodeAddress),
    ]).then(
      ([totalStake, totalEffectiveStake, nodeStake, nodeEffectiveStake, nodeMinipoolLimit]) =>
        ({totalStake, totalEffectiveStake, nodeStake, nodeEffectiveStake, nodeMinipoolLimit})
    );
  }

  // Get details before deposit
  const [ details1, balances1, stakingDetails1 ] = await Promise.all([
    getDetails(txOptions.from),
    getTokenBalances(),
    getStakingDetails(supernodeAddress)
  ]);

  // Perform deposit
  const tx = supernode.depositRpl(amount, txOptions);

  // If amount exceeds limit, it should revert
  if (details1.share.add(web3.utils.toBN(amount)).gt(details1.limit)){
    await shouldRevert(tx, 'Was able to deposit beyond limit', 'Exceeds capital limit');
    return;
  } else {
    await tx;
  }

  // Get details after deposit
  const [ details2, balances2, stakingDetails2 ] = await Promise.all([
    getDetails(txOptions.from),
    getTokenBalances(),
    getStakingDetails(supernodeAddress)
  ]);

  // Ensure shares increased by correct amount
  assert(details2.share.eq(details1.share.add(web3.utils.toBN(amount))), "Share did not increase by expected amount");

  // Check token balances
  assert(balances2.vaultRpl.eq(balances1.vaultRpl.add(web3.utils.toBN(amount))), 'Incorrect updated vault RPL balance');
  assert(balances2.stakingRpl.eq(balances1.stakingRpl.add(web3.utils.toBN(amount))), 'Incorrect updated RocketNodeStaking contract RPL vault balance');
}

