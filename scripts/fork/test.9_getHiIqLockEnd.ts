import {
  runwithImpersonation,
  contractAddress,
  timeConverter,
} from './util_functions';

async function getHiIqLockTime() {
  const hre = require('hardhat');

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const IQERC20ABI = require('../../artifacts/src/ERC20/IQERC20.sol/IQERC20')
    .abi;

  const hiiqAddress = contractAddress('HIIQ');
  const IQOwner = contractAddress('OWNER');
  const IQERC20MainnetAddress = contractAddress('IQ');

  const toAddress = '0xAe65930180ef4d86dbD1844275433E9e1d6311ED';

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    hre.network.config.url
  );

  await runwithImpersonation(toAddress, provider, hre, async (signer: any) => {
    const hiiqContract = new hre.ethers.Contract(hiiqAddress, hiiqABI, signer);

    console.log(
      'before toAddress HiIQ balance: ',
      hre.ethers.utils.formatUnits(
        await hiiqContract['balanceOf(address)'](toAddress),
        18
      )
    );

    const lockEndTime = await hiiqContract.locked__end(toAddress, {
      gasLimit: 400000,
    });
    const lockEndTimeDate = new Date(lockEndTime * 1000);
    console.log('locked__end hiiqContract 1', timeConverter(lockEndTime));
    console.log(
      'locked__end hiiqContract 2',
      lockEndTimeDate.toLocaleDateString('en-US'),
      lockEndTimeDate.toLocaleTimeString('en-US')
    );

    const blockNum = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNum);
    const blockTimestampDate = new Date(block.timestamp * 1000);

    console.log(
      'block.timestamp',
      blockTimestampDate.toLocaleDateString('en-US'),
      blockTimestampDate.toLocaleTimeString('en-US')
    );

    console.log(
      'after toAddress HiIQ balance: ',
      hre.ethers.utils.formatUnits(
        await hiiqContract['balanceOf(address)'](toAddress),
        18
      )
    );
  });
}

getHiIqLockTime()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
