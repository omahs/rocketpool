import { printTitle } from '../_utils/formatting';
import { RocketNodeDistributorFactory, RocketSupernodeDelegate, RocketTokenRPL } from '../_utils/artifacts';
import { approveRPL, mintRPL } from '../_helpers/tokens';
import { createSupernode } from './scenario-create';
import { depositEth } from './scenario-deposit-eth';
import { setEthLimit } from './scenario-set-eth-limit';
import { setRplLimit } from './scenario-set-rpl-limit';
import { selloutEth } from './scenario-buyout-eth';
import { depositRpl } from './scenario-deposit-rpl';
import { selloutRpl } from './scenario-buyout-rpl';
import { setOperatorLimit } from './scenario-set-operator-limit';
import { deposit } from './scenario-deposit';
import { distributeEth } from './scenario-distribute-eth';


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
      random,
    ] = accounts;


    // Setup
    let emptySupernode, emptySupernodeDistributor;

    before(async () => {
      // Create supernodes
      emptySupernode = await createSupernode('Etc/UTC', { from: supernodeOperator });

      // Calculate and store distributor address
      const rocketNodeDistributor = await RocketNodeDistributorFactory.deployed();
      emptySupernodeDistributor = await rocketNodeDistributor.getProxyAddress(emptySupernode);

      // Mint RPL to accounts
      const rplAmount = web3.utils.toWei('10000', 'ether');
      await mintRPL(owner, rplProvider1, rplAmount);
      await mintRPL(owner, rplProvider2, rplAmount);

      // Setup limits
      const rplDepositAmount = web3.utils.toWei('5000', 'ether');
      const ethDepositAmount = web3.utils.toWei('100', 'ether');
      await setRplLimit(emptySupernode, rplProvider1, rplDepositAmount, { from: supernodeOperator });
      await setRplLimit(emptySupernode, rplProvider2, rplDepositAmount, { from: supernodeOperator });
      await setEthLimit(emptySupernode, ethProvider1, ethDepositAmount, { from: supernodeOperator });
      await setEthLimit(emptySupernode, ethProvider2, ethDepositAmount, { from: supernodeOperator });
      await setOperatorLimit(emptySupernode, nodeOperator1, '1', { from: supernodeOperator });
    });


    //
    // ETH provider
    //


    it(printTitle('ETH provider', 'can sellout shares to another provider'), async () => {
      // Make both providers have an equal amount of shares (1 ETH)
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('1', 'ether') });
      // Send fake rewards
      await web3.eth.sendTransaction({
        from: random,
        to: emptySupernodeDistributor,
        value: web3.utils.toWei('4', 'ether'),
      });
      // Distribute the ETH rewards
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await distributeEth(emptySupernode, { from: random });
      // Set buyout limit on provider 2
      await supernode.setEthBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: ethProvider2 });
      // Attempt two sellouts
      await selloutEth(emptySupernode, ethProvider2, web3.utils.toWei('0.25', 'ether'), false, { from: ethProvider1 });
      await selloutEth(emptySupernode, ethProvider2, web3.utils.toWei('0.25', 'ether'), false, { from: ethProvider1 });
    });


    it(printTitle('ETH provider', 'cannot sellout shares to another provider with insufficient unclaimed rewards'), async () => {
      // Make both providers have an equal amount of shares (1 ETH)
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('1', 'ether') });
      // Set buyout limit on provider 2
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setEthBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: ethProvider2 });
      // Attempt the sellout
      await selloutEth(emptySupernode, ethProvider2, web3.utils.toWei('0.5', 'ether'), true, { from: ethProvider1 });
    });


    it(printTitle('ETH provider', 'cannot sellout shares to another provider if it exceeds their buyout limit'), async () => {
      // Make both providers have an equal amount of shares (1 ETH)
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('1', 'ether') });
      // Send fake rewards
      await web3.eth.sendTransaction({
        from: random,
        to: emptySupernodeDistributor,
        value: web3.utils.toWei('4', 'ether'),
      });
      // Distribute the ETH rewards
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await distributeEth(emptySupernode, { from: random });
      // Attempt the sellout
      await selloutEth(emptySupernode, ethProvider2, web3.utils.toWei('0.5', 'ether'), true, { from: ethProvider1 });
    });


    it(printTitle('ETH provider', 'cannot sellout shares to another provider if it exceeds their capital limit'), async () => {
      // Make both providers have an equal amount of shares (1 ETH)
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      await depositEth(emptySupernode, { from: ethProvider2, value: web3.utils.toWei('1', 'ether') });
      // Set capital limit
      await setEthLimit(emptySupernode, ethProvider2, web3.utils.toWei('1', 'ether'), { from: supernodeOperator });
      // Send fake rewards
      await web3.eth.sendTransaction({
        from: random,
        to: emptySupernodeDistributor,
        value: web3.utils.toWei('4', 'ether'),
      });
      // Distribute the ETH rewards
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await distributeEth(emptySupernode, { from: random });
      // Set buyout limit on provider 2
      await supernode.setEthBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: ethProvider2 });
      // Attempt the sellout
      await selloutEth(emptySupernode, ethProvider2, web3.utils.toWei('0.5', 'ether'), true, { from: ethProvider1 });
    });


    it(printTitle('ETH provider', 'can sellout shares to another provider using supernode fees'), async () => {
      // Make the supernode a capital provider
      await setEthLimit(emptySupernode, supernodeOperator, web3.utils.toWei('1.5', 'ether'), { from: supernodeOperator });
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('1', 'ether') });
      // Set supernode fee to 50%
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees(web3.utils.toWei('0.5', 'ether'), '0', '0', '0', { from: supernodeOperator });
      // Send fake rewards
      await web3.eth.sendTransaction({
        from: random,
        to: emptySupernodeDistributor,
        value: web3.utils.toWei('4', 'ether'),
      });
      // Distribute the ETH rewards
      await distributeEth(emptySupernode, { from: random });
      // Set buyout limit on supernode operator
      await supernode.setEthBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: supernodeOperator });
      // Attempt to sell out to the supernode operator
      await selloutEth(emptySupernode, supernodeOperator, web3.utils.toWei('0.5', 'ether'), false, { from: ethProvider1 });
    });


    it(printTitle('ETH provider', 'can sellout shares to another provider using node operator fees'), async () => {
      // Make the node operator a capital provider
      await setEthLimit(emptySupernode, nodeOperator1, web3.utils.toWei('1.5', 'ether'), { from: supernodeOperator });
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('16', 'ether') });
      // Set supernode fee to 50%
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees('0', '0', web3.utils.toWei('0.5', 'ether'), '0', { from: supernodeOperator });
      // Deposit RPL and create a minipool
      const rplDepositAmount = web3.utils.toWei('5000', 'ether');
      await approveRPL(emptySupernode, rplDepositAmount, { from: rplProvider1 });
      await depositRpl(emptySupernode, rplDepositAmount, { from: rplProvider1 });
      await deposit(emptySupernode, { from: nodeOperator1 });
      // Send fake rewards
      await web3.eth.sendTransaction({
        from: random,
        to: emptySupernodeDistributor,
        value: web3.utils.toWei('4', 'ether'),
      });
      // Distribute the ETH rewards
      await distributeEth(emptySupernode, { from: random });
      // Set buyout limit on supernode operator
      await supernode.setEthBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: nodeOperator1 });
      // Attempt to sell out to the supernode operator
      await selloutEth(emptySupernode, nodeOperator1, web3.utils.toWei('0.5', 'ether'), false, { from: ethProvider1 });
    });


    //
    // RPL provider
    //


    it(printTitle('RPL provider', 'can sellout shares to another provider'), async () => {
      const rocketTokenRPL = await RocketTokenRPL.deployed();
      // Make both providers have an equal amount of shares (1 RPL)
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Send fake rewards
      await mintRPL(owner, random, web3.utils.toWei('4', 'ether'));
      await rocketTokenRPL.transfer(emptySupernode, web3.utils.toWei('4', 'ether'), { from: random });
      // Distribute the RPL rewards
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.distributeRpl();
      // Set buyout limit on provider 2
      await supernode.setRplBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Attempt the sellout
      await selloutRpl(emptySupernode, rplProvider2, web3.utils.toWei('0.5', 'ether'), false, { from: rplProvider1 });
    });


    it(printTitle('RPL provider', 'cannot sellout shares to another provider with insufficient unclaimed rewards'), async () => {
      // Make both providers have an equal amount of shares (1 RPL)
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Distribute the RPL rewards
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.distributeRpl();
      // Set buyout limit on provider 2
      await supernode.setRplBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Attempt the sellout
      await selloutRpl(emptySupernode, rplProvider2, web3.utils.toWei('0.5', 'ether'), true, { from: rplProvider1 });
    });


    it(printTitle('RPL provider', 'cannot sellout shares to another provider if it exceeds their buyout limit'), async () => {
      const rocketTokenRPL = await RocketTokenRPL.deployed();
      // Make both providers have an equal amount of shares (1 RPL)
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Send fake rewards
      await mintRPL(owner, random, web3.utils.toWei('4', 'ether'));
      await rocketTokenRPL.transfer(emptySupernode, web3.utils.toWei('4', 'ether'), { from: random });
      // Distribute the RPL rewards
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.distributeRpl();
      // Attempt the sellout
      await selloutRpl(emptySupernode, rplProvider2, web3.utils.toWei('0.5', 'ether'), true, { from: rplProvider1 });
    });


    it(printTitle('RPL provider', 'cannot sellout shares to another provider if it exceeds their capital limit'), async () => {
      const rocketTokenRPL = await RocketTokenRPL.deployed();
      // Make both providers have an equal amount of shares (1 RPL)
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Set capital limit
      await setRplLimit(emptySupernode, rplProvider2, web3.utils.toWei('1', 'ether'), { from: supernodeOperator });
      // Send fake rewards
      await mintRPL(owner, random, web3.utils.toWei('4', 'ether'));
      await rocketTokenRPL.transfer(emptySupernode, web3.utils.toWei('4', 'ether'), { from: random });
      // Distribute the RPL rewards
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.distributeRpl();
      // Set buyout limit on provider 2
      await supernode.setRplBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: rplProvider2 });
      // Attempt the sellout
      await selloutRpl(emptySupernode, rplProvider2, web3.utils.toWei('0.5', 'ether'), true, { from: rplProvider1 });
    });


    it(printTitle('RPL provider', 'can sellout shares to another provider using supernode fees'), async () => {
      const rocketTokenRPL = await RocketTokenRPL.deployed();
      // Make the supernode a capital provider
      await setRplLimit(emptySupernode, supernodeOperator, web3.utils.toWei('1.5', 'ether'), { from: supernodeOperator });
      await approveRPL(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      await depositRpl(emptySupernode, web3.utils.toWei('1', 'ether'), { from: rplProvider1 });
      // Set supernode fee to 50%
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees('0', web3.utils.toWei('0.5', 'ether'), '0', '0', { from: supernodeOperator });
      // Send fake rewards
      await mintRPL(owner, random, web3.utils.toWei('4', 'ether'));
      await rocketTokenRPL.transfer(emptySupernode, web3.utils.toWei('4', 'ether'), { from: random });
      // Distribute the RPL rewards
      await supernode.distributeRpl();
      // Set buyout limit on supernode operator
      await supernode.setRplBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: supernodeOperator });
      // Attempt to sell out to the supernode operator
      await selloutRpl(emptySupernode, supernodeOperator, web3.utils.toWei('0.5', 'ether'), false, { from: rplProvider1 });
    });


    it(printTitle('RPL provider', 'can sellout shares to another provider using node operator fees'), async () => {
      const rocketTokenRPL = await RocketTokenRPL.deployed();
      // Make the node operator a capital provider
      await setRplLimit(emptySupernode, nodeOperator1, web3.utils.toWei('1.5', 'ether'), { from: supernodeOperator });
      // Deposit enough ETH for a minipool
      await depositEth(emptySupernode, { from: ethProvider1, value: web3.utils.toWei('16', 'ether') });
      // Set supernode fee to 50%
      const supernode = await RocketSupernodeDelegate.at(emptySupernode);
      await supernode.setFees('0', '0', '0', web3.utils.toWei('0.5', 'ether'), { from: supernodeOperator });
      // Deposit RPL and create a minipool
      const rplDepositAmount = web3.utils.toWei('5000', 'ether');
      await approveRPL(emptySupernode, rplDepositAmount, { from: rplProvider1 });
      await depositRpl(emptySupernode, rplDepositAmount, { from: rplProvider1 });
      await deposit(emptySupernode, { from: nodeOperator1 });
      // Send fake rewards
      await mintRPL(owner, random, web3.utils.toWei('4', 'ether'));
      await rocketTokenRPL.transfer(emptySupernode, web3.utils.toWei('4', 'ether'), { from: random });
      // Distribute the ETH rewards
      await supernode.distributeRpl();
      // Set buyout limit on supernode operator
      await supernode.setRplBuyoutLimit(web3.utils.toWei('1', 'ether'), { from: nodeOperator1 });
      // Attempt to sell out to the supernode operator
      await selloutRpl(emptySupernode, nodeOperator1, web3.utils.toWei('0.5', 'ether'), false, { from: rplProvider1 });
    });
  });
}
