import {runwithImpersonation, contractAddress} from './util_functions';

async function moveChainForward() {
  const hre = require('hardhat');

  const secondsInADay = 24 * 60 * 60;

  function timestampToString(timestamp: any) {
    const timestampDate = new Date(timestamp * 1000);
    return `${timestampDate.toLocaleDateString('en-US')} ${timestampDate.toLocaleTimeString('en-US')}`;
  }

  async function outputBlockTimestamp(provider: any) {
    let blockNum = await provider.getBlockNumber();
    let block = await provider.getBlock(blockNum);
    let blockTimestampStr = timestampToString(block.timestamp)
    console.log('\n===============================================');
    console.log(`block timestamp: ${blockTimestampStr}`);
  }

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    hre.network.config.url
  );

  await outputBlockTimestamp(provider);

  await provider.send('evm_increaseTime', [secondsInADay * 6]);
  await provider.send('evm_mine', []);

  await outputBlockTimestamp(provider);
}

moveChainForward()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
