import { RocketSupernodeDelegate } from '../_utils/artifacts';
import { shouldRevert } from '../_utils/testing';

// Deposit ETH into a supernode
export async function depositEth(supernodeAddress, txOptions) {
  // Create instance
  const supernode = await RocketSupernodeDelegate.at(supernodeAddress);

  async function getDetails() {
    return Promise.all([
      supernode.getEthLimit.call(txOptions.from),
      supernode.getEthShare.call(txOptions.from),
    ]).then(
      ([limit, share]) =>
        ({limit, share})
    );
  }

  // Get details before deposit
  const details1 = await getDetails();

  // Perform deposit
  const tx = supernode.depositEth(txOptions);

  // If amount exceeds limit, it should revert
  if (details1.share.add(web3.utils.toBN(txOptions.value)).gt(details1.limit)){
    await shouldRevert(tx, 'Was able to deposit beyond limit', 'Exceeds capital limit');
    return;
  } else {
    await tx;
  }

  // Get details after deposit
  const details2 = await getDetails();

  // Ensure shares increased by correct amount
  assert(details2.share.eq(details1.share.add(web3.utils.toBN(txOptions.value))), "Share did not increase by msg.value");
}

