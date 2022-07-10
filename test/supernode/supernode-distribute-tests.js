import { printTitle } from '../_utils/formatting';
import { RocketNodeDistributorFactory, RocketSupernodeDelegate, RocketTokenRPL } from '../_utils/artifacts';
import { approveRPL, mintRPL } from '../_helpers/tokens';
import { createSupernode } from './scenario-create';
import { depositEth } from './scenario-deposit-eth';
import { setEthLimit } from './scenario-set-eth-limit';
import { setRplLimit } from './scenario-set-rpl-limit';
import { distributeEth } from './scenario-distribute-eth';
import { depositRpl } from './scenario-deposit-rpl';
import { setOperatorLimit } from './scenario-set-operator-limit';
import { deposit } from './scenario-deposit';
import { claimEth } from './scenario-claim-eth';
import { distributeRpl } from './scenario-distribute-rpl';
import { claimRpl } from './scenario-claim-rpl';


export default function() {
  contract('RocketSupernode', async (accounts) => {

    // Accounts
    const [
      owner,
      supernodeOperator,
      ethProvider1,
      ethProvider2,
      rplProvider1,
      rplProvider2,
      nodeOperator1,
      nodeOperator2,
      random,
    ] = accounts;

    let rocketNodeDistributor;

    // Setup
    let emptySupernode, emptySupernodeDistributor;

    before(async () => {
      // Get contracts
      rocketNodeDistributor = await RocketNodeDistributorFactory.deployed();

      // Create supernode
      emptySupernode = await createSupernode('Etc/UTC', { from: supernodeOperator });

      // Mint RPL to accounts
      const rplAmount = web3.utils.toWei('10000', 'ether');
      await mintRPL(owner, rplProvider1, rplAmount);
      await mintRPL(owner, rplProvider2, rplAmount);

      // Setup capitalised supernode for testing
      const rplDepositAmount = web3.utils.toWei('5000', 'ether');
      const ethDepositAmount = web3.utils.toWei('100', 'ether');
      await setRplLimit(emptySupernode, rplProvider1, rplDepositAmount, { from: supernodeOperator });
      await setRplLimit(emptySupernode, rplProvider2, rplDepositAmount, { from: supernodeOperator });
      await setEthLimit(emptySupernode, ethProvider1, ethDepositAmount, { from: supernodeOperator });
      await setEthLimit(emptySupernode, ethProvider2, ethDepositAmount, { from: supernodeOperator });

      // Set approvals
      await approveRPL(emptySupernode, rplDepositAmount, { from: rplProvider1 });
      await approveRPL(emptySupernode, rplDepositAmount, { from: rplProvider2 });
    });


    async function fakeEthRewards(supernode, amount) {
      let distributor = await rocketNodeDistributor.getProxyAddress(supernode);
      await web3.eth.sendTransaction({
        from: random,
        to: distributor,
        value: amount,
      });
    }


    async function fakeRplRewards(supernode, amount) {
      const rocketTokenRPL = await RocketTokenRPL.deployed();
      await mintRPL(owner, random, amount);
      await rocketTokenRPL.transfer(supernode, amount, { from: random });
    }


    //
    // ETH provider
    //


    it(printTitle('ETH provider', 'can distribute rewards with uneven share split and no fees'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('2', 'ether') });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
    });


    it(printTitle('ETH provider', 'can distribute rewards with no fees'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('1', 'ether') });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
    });


    it(printTitle('ETH provider', 'can distribute rewards with supernode fees'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('1', 'ether') });
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      // Set fees
      await supernode.setFees(web3.utils.toWei('0.05', 'ether'), '0', '0', '0', { from: supernodeOperator });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
    });


    it(printTitle('ETH provider', 'can distribute rewards with node operator fees'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('16', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('16', 'ether') });
      // Deposit RPL
      const rplDepositAmount = web3.utils.toWei('5000', 'ether');
      await depositRpl(emptySupernode, rplDepositAmount, { from: rplProvider1 });
      await setOperatorLimit(emptySupernode, nodeOperator1, web3.utils.toBN('1'), { from: supernodeOperator });
      await deposit(emptySupernode, { from: nodeOperator1 });
      // Set fees
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees(web3.utils.toWei('0.05', 'ether'), '0', web3.utils.toWei('0.1', 'ether'), '0', { from: supernodeOperator });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
    });


    it(printTitle('ETH provider', 'can distribute rewards multiple times'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('16', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('16', 'ether') });
      // Deposit RPL
      const rplDepositAmount = web3.utils.toWei('5000', 'ether');
      await depositRpl(emptySupernode, rplDepositAmount, { from: rplProvider1 });
      await setOperatorLimit(emptySupernode, nodeOperator1, web3.utils.toBN('1'), { from: supernodeOperator });
      await deposit(emptySupernode, { from: nodeOperator1 });
      // Set fees
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees(web3.utils.toWei('0.05', 'ether'), '0', web3.utils.toWei('0.1', 'ether'), '0', { from: supernodeOperator });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
      // Distribute with no rewards
      await distributeEth(emptySupernode, { from: random });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('10', 'ether'));
      // Distribute again with rewards
      await distributeEth(emptySupernode, { from: random });
    });


    it(printTitle('ETH provider', 'can deposit after rewards have been distributed and distribute again'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('1', 'ether') });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
    });


    it(printTitle('ETH provider', 'can distribute rewards and claim them'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('2', 'ether') });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
      await claimEth(emptySupernode, { from: ethProvider1 });
      await claimEth(emptySupernode, { from: ethProvider2 });
    });


    it(printTitle('ETH provider', 'can distribute and claim rewards after claiming previous rewards'), async () => {
      // Deposit ETH
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('2', 'ether') });
      // Send some fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeEth(emptySupernode, { from: random });
      await claimEth(emptySupernode, { from: ethProvider1 });
      // Send some more fake rewards
      await fakeEthRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute and claim again
      await distributeEth(emptySupernode, { from: random });
      await claimEth(emptySupernode, { from: ethProvider1 });
      await claimEth(emptySupernode, { from: ethProvider2 });
    });


    //
    // RPL provider
    //


    it(printTitle('RPL provider', 'can distribute rewards with uneven share split and no fees'), async () => {
      // Deposit ETH
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('2', 'ether'), { from: rplProvider2 });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
    });


    it(printTitle('RPL provider', 'can distribute rewards with no fees'), async () => {
      // Deposit RPL
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
    });


    it(printTitle('RPL provider', 'can distribute rewards with supernode fees'), async () => {
      // Deposit RPL
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      // Set fees
      await supernode.setFees('0', web3.utils.toWei('0.05', 'ether'), '0', '0', { from: supernodeOperator });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
    });


    it(printTitle('RPL provider', 'can distribute rewards with node operator fees'), async () => {
      // Deposit ETH and RPL
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('16', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('16', 'ether') });
      await depositRpl(emptySupernode, web3.utils.toWei('5000', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('5000', 'ether'), { from: rplProvider2 });
      await setOperatorLimit(emptySupernode, nodeOperator1, web3.utils.toBN('1'), { from: supernodeOperator });
      await deposit(emptySupernode, { from: nodeOperator1 });
      // Set fees
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees('0', web3.utils.toWei('0.05', 'ether'), '0', web3.utils.toWei('0.1', 'ether'), { from: supernodeOperator });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
    });


    it(printTitle('RPL provider', 'can distribute rewards multiple times'), async () => {
      // Deposit ETH and RPL
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('16', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('16', 'ether') });
      await depositRpl(emptySupernode, web3.utils.toWei('5000', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('5000', 'ether'), { from: rplProvider2 });
      await setOperatorLimit(emptySupernode, nodeOperator1, web3.utils.toBN('1'), { from: supernodeOperator });
      await deposit(emptySupernode, { from: nodeOperator1 });
      // Set fees
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees('0', web3.utils.toWei('0.05', 'ether'), '0', web3.utils.toWei('0.1', 'ether'), { from: supernodeOperator });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
      // Distribute with no rewards
      await distributeRpl(emptySupernode, { from: random });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('10', 'ether'));
      // Distribute again with rewards
      await distributeRpl(emptySupernode, { from: random });
    });


    it(printTitle('RPL provider', 'can deposit after rewards have been distributed and distribute again'), async () => {
      // Deposit RPL
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
      // Deposit RPL
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
    });


    it(printTitle('RPL provider', 'can distribute rewards and claim them'), async () => {
      // Deposit RPL
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('2', 'ether'), { from: rplProvider2 });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
      await claimRpl(emptySupernode, { from: rplProvider1 });
      await claimRpl(emptySupernode, { from: rplProvider2 });
    });


    it(printTitle('RPL provider', 'can distribute and claim rewards after claiming previous rewards'), async () => {
      // Deposit RPL
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('2', 'ether'), { from: rplProvider2 });
      // Send some fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute
      await distributeRpl(emptySupernode, { from: random });
      await claimRpl(emptySupernode, { from: rplProvider1 });
      // Send some more fake rewards
      await fakeRplRewards(emptySupernode, web3.utils.toWei('4', 'ether'));
      // Distribute and claim again
      await distributeRpl(emptySupernode, { from: random });
      await claimRpl(emptySupernode, { from: rplProvider1 });
      await claimRpl(emptySupernode, { from: rplProvider2 });
    });
  });
}
