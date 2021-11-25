import {runwithImpersonation, contractAddress} from './util_functions';

async function syncGauge() {
  const hre = require('hardhat');

  const IQERC20ABI = require('../../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;
  const uniswapGaugeABI = require('../../artifacts/src/Curve/StakingRewardsMultiGauge.sol/StakingRewardsMultiGauge').abi;
  const uniswapV2PairABI = require('../../artifacts/src/Interfaces/IUniswapV2Pair.sol/IUniswapV2Pair').abi;
  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const hiiqAddress = contractAddress('HIIQ');
  const iqAddress = contractAddress('IQ');
  const REWARDS_DIST_ADDR = contractAddress('GAUGE_REWARDS_DISTRIBUTOR');
  const IqFraxlpTokenAddress = contractAddress('UNISWAP_LP_IQ_FRAX');
  const IqEthLpTokenAddress = contractAddress('UNISWAP_LP_IQ_ETH');
  const OWNER_ADDR = contractAddress('OWNER');

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = contractAddress('GAUGE_CONTROLLER');
  const UNI_GAUGE_FRAX_IQ_ADDR = contractAddress('UNI_LP_GAUGE_IQ_FRAX');
  const UNI_GAUGE_ETH_IQ_ADDR = contractAddress('UNI_LP_GAUGE_IQ_ETH');

  const testUser = '0xAe65930180ef4d86dbD1844275433E9e1d6311ED';

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

  const gauge_lpToken_map = (addr: any) => {
    if (addr == UNI_GAUGE_FRAX_IQ_ADDR) return IqFraxlpTokenAddress;
    else if (addr == UNI_GAUGE_ETH_IQ_ADDR) return IqEthLpTokenAddress;
  };

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    hre.network.config.url
  );

  await runwithImpersonation(OWNER_ADDR, provider, hre, async (signer: any) => {
    console.log('signer.address', signer.address);

    const GaugeToUse = UNI_GAUGE_FRAX_IQ_ADDR;

    const uniswapGauge = new hre.ethers.Contract(
      GaugeToUse,
      uniswapGaugeABI,
      signer
    );
    await outputBlockTimestamp(provider)
    console.log(`periodFinish: ${timestampToString(await uniswapGauge.periodFinish())}`);

    await uniswapGauge.sync()
  });
}

syncGauge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
