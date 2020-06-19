import { takeSnapshot, revertSnapshot } from '../_utils/evm';
import { printTitle } from '../_utils/formatting';
import { shouldRevert } from '../_utils/testing';
import { getValidatorPubkey } from '../_utils/beacon';
import { createMinipool, stakeMinipool, submitMinipoolExited, submitMinipoolWithdrawable } from '../_helpers/minipool';
import { depositValidatorWithdrawal } from '../_helpers/network';
import { registerNode, setNodeTrusted } from '../_helpers/node';
import { depositWithdrawal, processWithdrawal } from './scenarios-withdrawal';

export default function() {
    contract('RocketNetworkWithdrawal', async (accounts) => {


        // Accounts
        const [
            owner,
            node,
            trustedNode,
            random,
        ] = accounts;


        // State snapshotting
        let snapshotId;
        beforeEach(async () => { snapshotId = await takeSnapshot(web3); });
        afterEach(async () => { await revertSnapshot(web3, snapshotId); });


        // Setup
        let stakingValidatorPubkey = getValidatorPubkey();
        let withdrawableValidatorPubkey = getValidatorPubkey();
        let withdrawalBalance = web3.utils.toWei('36', 'ether');
        before(async () => {

            // Register node
            await registerNode({from: node});

            // Register trusted node
            await registerNode({from: trustedNode});
            await setNodeTrusted(trustedNode, {from: owner});

            // Create minipools
            let stakingMinipool = await createMinipool({from: node, value: web3.utils.toWei('32', 'ether')});
            let withdrawableMinipool = await createMinipool({from: node, value: web3.utils.toWei('32', 'ether')});
            await stakeMinipool(stakingMinipool, stakingValidatorPubkey, {from: node});
            await stakeMinipool(withdrawableMinipool, withdrawableValidatorPubkey, {from: node});
            await submitMinipoolExited(withdrawableMinipool.address, 1, {from: trustedNode});
            await submitMinipoolWithdrawable(withdrawableMinipool.address, withdrawalBalance, 1, {from: trustedNode});

        });


        //
        // Deposit withdrawals
        //


        


        //
        // Process withdrawals
        //


        it(printTitle('trusted node', 'can process a validator withdrawal'), async () => {

            // Deposit withdrawal
            await depositValidatorWithdrawal({from: owner, value: withdrawalBalance});

            // Process withdrawal
            await processWithdrawal(withdrawableValidatorPubkey, {
                from: trustedNode,
            });

        });


        it(printTitle('trusted node', 'cannot process a withdrawal for an invalid validator'), async () => {

            // Deposit withdrawal
            await depositValidatorWithdrawal({from: owner, value: withdrawalBalance});

            // Attempt to process withdrawal
            await shouldRevert(processWithdrawal(getValidatorPubkey(), {
                from: trustedNode,
            }), 'Processed a withdrawal for an invalid validator');

        });


        it(printTitle('trusted node', 'cannot process a validator withdrawal for a minipool which is not withdrawable'), async () => {

            // Deposit withdrawal
            await depositValidatorWithdrawal({from: owner, value: withdrawalBalance});

            // Process withdrawal
            await shouldRevert(processWithdrawal(stakingValidatorPubkey, {
                from: trustedNode,
            }), 'Processed a validator withdrawal for a minipool which was not withdrawable');

        });


        it(printTitle('trusted node', 'cannot process a validator withdrawal which has already been processed'), async () => {

            // Deposit withdrawals
            await depositValidatorWithdrawal({from: owner, value: withdrawalBalance});
            await depositValidatorWithdrawal({from: owner, value: withdrawalBalance});

            // Process withdrawal
            await processWithdrawal(withdrawableValidatorPubkey, {from: trustedNode});

            // Attempt to process withdrawal again
            await shouldRevert(processWithdrawal(withdrawableValidatorPubkey, {
                from: trustedNode,
            }), 'Processed a validator withdrawal which had already been processed');

        });


        it(printTitle('trusted node', 'cannot process a validator withdrawal with an insufficient withdrawal pool balance'), async () => {

            // Attempt to process withdrawal
            await shouldRevert(processWithdrawal(withdrawableValidatorPubkey, {
                from: trustedNode,
            }), 'Processed a validator withdrawal with an insufficient withdrawal pool balance');

        });


        it(printTitle('regular node', 'cannot process a validator withdrawal'), async () => {

            // Deposit withdrawal
            await depositValidatorWithdrawal({from: owner, value: withdrawalBalance});

            // Attempt to process withdrawal
            await shouldRevert(processWithdrawal(withdrawableValidatorPubkey, {
                from: node,
            }), 'Regular node processed a validator withdrawal');

        });


    });
}
