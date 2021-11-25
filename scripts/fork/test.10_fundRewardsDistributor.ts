import {
  runwithImpersonation,
  contractAddress,
  forkEthFaucet,
} from './util_functions';

async function fundRewardsDistributor() {
  const hre = require('hardhat');

  const IQERC20ABI = require('../../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;

  const IQOwner = contractAddress('OWNER');
  const IQERC20MainnetAddress = contractAddress('IQ');

  const REWARDS_DIST_ADDR = contractAddress('GAUGE_REWARDS_DISTRIBUTOR');

  const UNI_GAUGE_FRAX_IQ_ADDR = contractAddress('UNI_LP_GAUGE_IQ_FRAX');
  const UNI_GAUGE_ETH_IQ_ADDR = contractAddress('UNI_LP_GAUGE_IQ_ETH');

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    hre.network.config.url
  );

  await runwithImpersonation(IQOwner, provider, hre, async (signer: any) => {
    const iqContract = new hre.ethers.Contract(
      IQERC20MainnetAddress,
      IQERC20ABI,
      signer
    );

    console.log(
      'from IQ balance: ',
      hre.ethers.utils.formatUnits(await iqContract.balanceOf(IQOwner), 18)
    );

    const howManyTokens = hre.ethers.BigNumber.from(
      hre.ethers.utils.parseEther('50000000')
    );

    const estGas = await iqContract.estimateGas.mint(UNI_GAUGE_FRAX_IQ_ADDR, howManyTokens);
    const tx = await iqContract.mint(UNI_GAUGE_FRAX_IQ_ADDR, howManyTokens, {
      gasLimit: estGas,
    });

    await tx.wait();

    console.log(
      'toAddress IQ balance: ',
      hre.ethers.utils.formatUnits(await iqContract.balanceOf(UNI_GAUGE_FRAX_IQ_ADDR), 18)
    );
  });
}

fundRewardsDistributor()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
