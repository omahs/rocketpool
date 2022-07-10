import { printTitle } from '../_utils/formatting';
import { RocketNodeDistributorFactory, RocketSupernodeDelegate } from '../_utils/artifacts';
import { approveRPL, mintRPL } from '../_helpers/tokens';
import { createSupernode } from './scenario-create';
import { depositEth } from './scenario-deposit-eth';
import { depositRpl } from './scenario-deposit-rpl';
import { setEthLimit } from './scenario-set-eth-limit';
import { setRplLimit } from './scenario-set-rpl-limit';
import { deposit } from './scenario-deposit';
import { setOperatorLimit } from './scenario-set-operator-limit';


export default function() {
  contract('RocketSupernode', async (accounts) => {

    // Accounts
    const [
      owner,
      supernodeOperator,
      depositedEthProvider,
      ethProvider,
      depositedRplProvider,
      rplProvider,
      nodeOperator1,
      nodeOperator2,
      random,
    ] = accounts;


    // Setup
    let emptySupernode, capitalisedSupernode;

    before(async () => {
      // Create supernodes
      emptySupernode = await createSupernode('Etc/UTC', { from: supernodeOperator });
      capitalisedSupernode = await createSupernode('Etc/UTC', { from: supernodeOperator });

      // Mint RPL to accounts
      const rplAmount = web3.utils.toWei('10000', 'ether');
      await mintRPL(owner, depositedRplProvider, rplAmount);

      // Setup capitalised supernode for testing
      const rplDepositAmount = web3.utils.toWei('5000', 'ether');
      const ethDepositAmount = web3.utils.toWei('100', 'ether');
      await setRplLimit(capitalisedSupernode, depositedRplProvider, rplDepositAmount, { from: supernodeOperator });
      await setRplLimit(capitalisedSupernode, rplProvider, rplDepositAmount, { from: supernodeOperator });
      await setEthLimit(capitalisedSupernode, depositedEthProvider, ethDepositAmount, { from: supernodeOperator });
      await setEthLimit(capitalisedSupernode, ethProvider, ethDepositAmount, { from: supernodeOperator });
      // Deposit RPL
      await approveRPL(capitalisedSupernode, rplDepositAmount, { from: depositedRplProvider });
      await depositRpl(capitalisedSupernode, rplDepositAmount, { from: depositedRplProvider });
      // Deposit ETH
      await depositEth(capitalisedSupernode, { from: depositedEthProvider, value: ethDepositAmount });
    });

    //
    // ETH provider
    //

    it(printTitle('ETH provider', 'cannot deposit ETH beyond limit'), async () => {
      await depositEth(emptySupernode, { from: depositedEthProvider, value: web3.utils.toWei('1', 'ether') });
    });


    it(printTitle('ETH provider', 'can deposit ETH within limit'), async () => {
      await setEthLimit(emptySupernode, depositedEthProvider, web3.utils.toWei('1', 'ether'), { from: supernodeOperator });
      await depositEth(emptySupernode, { from: depositedEthProvider, value: web3.utils.toWei('1', 'ether') });
    });

    //
    // RPL provider
    //

    it(printTitle('RPL provider', 'cannot deposit RPL beyond limit'), async () => {
      const rplAmount = web3.utils.toWei('5000', 'ether');
      await approveRPL(emptySupernode, rplAmount, { from: depositedRplProvider });
      await depositRpl(emptySupernode, rplAmount, { from: depositedRplProvider });
    });


    it(printTitle('RPL provider', 'can deposit RPL within limit'), async () => {
      const rplAmount = web3.utils.toWei('5000', 'ether');
      await approveRPL(emptySupernode, rplAmount, { from: depositedRplProvider });
      await setRplLimit(emptySupernode, depositedRplProvider, rplAmount, { from: supernodeOperator });
      await depositRpl(emptySupernode, rplAmount, { from: depositedRplProvider });
    });

    //
    // Node operator
    //

    it(printTitle('node operator', 'can create a minipool on behalf of a supernode'), async () => {
      await setOperatorLimit(capitalisedSupernode, nodeOperator1, web3.utils.toBN('1'), { from: supernodeOperator });
      await deposit(capitalisedSupernode, { from: nodeOperator1 });
    });
  });
}
