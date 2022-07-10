import { RocketSupernodeManager, RocketNodeManager } from '../_utils/artifacts';


// Create a supernode
export async function createSupernode(timezoneLocation, txOptions) {

  // Load contracts
  const [
    rocketSupernodeManager,
    rocketNodeManager
  ] = await Promise.all([
      RocketSupernodeManager.deployed(),
      RocketNodeManager.deployed(),
  ]);

  // Get node details
  function getNodeDetails(nodeAddress) {
    return Promise.all([
      rocketNodeManager.getNodeExists.call(nodeAddress),
      rocketNodeManager.getNodeTimezoneLocation.call(nodeAddress),
    ]).then(
      ([exists, timezoneLocation]) =>
        ({exists, timezoneLocation})
    );
  }

  // Get initial node index
  let nodeCount1 = await rocketNodeManager.getNodeCount.call();

  // Create
  const tx = await rocketSupernodeManager.createSupernode(timezoneLocation, txOptions);

  // Find event
  const createLog = tx.logs.find(log => log.event === 'SupernodeCreated');
  assert.isNotNull(createLog, 'SupernodeCreated event was not emitted');

  const nodeAddress = createLog.args.supernodeAddress;

  // Get updated node index & node details
  let nodeCount2 = await rocketNodeManager.getNodeCount.call();

  let [lastNodeAddress, details] = await Promise.all([
    rocketNodeManager.getNodeAt.call(nodeCount2.sub(web3.utils.toBN(1))),
    getNodeDetails(nodeAddress),
  ]);

  // Check details
  assert(nodeCount2.eq(nodeCount1.add(web3.utils.toBN(1))), 'Incorrect updated node count');
  assert.equal(lastNodeAddress, nodeAddress, 'Incorrect updated node index');
  assert.isTrue(details.exists, 'Incorrect node exists flag');
  assert.equal(details.timezoneLocation, timezoneLocation, 'Incorrect node timezone location');

  // Return address
  return nodeAddress;
}

