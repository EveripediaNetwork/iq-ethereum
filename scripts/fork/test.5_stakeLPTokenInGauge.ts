import {runwithImpersonation, contractAddress} from './util_functions';

async function stakeLPTokenInGauge() {
  const hre = require('hardhat');

  const uniswapGaugeABI = require('../../artifacts/src/Curve/StakingRewardsMultiGauge.sol/StakingRewardsMultiGauge')
    .abi;
  const uniswapV2PairABI = require('../../artifacts/src/Interfaces/IUniswapV2Pair.sol/IUniswapV2Pair')
    .abi;
  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController')
    .abi;
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const hiiqAddress = contractAddress('HIIQ');
  const iqAddress = contractAddress('IQ');
  const IqFraxlpTokenAddress = contractAddress('UNISWAP_LP_IQ_FRAX');
  const IqEthLpTokenAddress = contractAddress('UNISWAP_LP_IQ_ETH');
  const OWNER_ADDR = contractAddress('OWNER');

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = contractAddress('GAUGE_CONTROLLER');
  const UNI_GAUGE_FRAX_IQ_ADDR = contractAddress('UNI_LP_GAUGE_IQ_FRAX');
  const UNI_GAUGE_ETH_IQ_ADDR = contractAddress('UNI_LP_GAUGE_IQ_ETH');

  const testUser = '0xAe65930180ef4d86dbD1844275433E9e1d6311ED';

  const gauge_lpToken_map = (addr: any) => {
    if (addr == UNI_GAUGE_FRAX_IQ_ADDR) return IqFraxlpTokenAddress;
    else if (addr == UNI_GAUGE_ETH_IQ_ADDR) return IqEthLpTokenAddress;
  };

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    hre.network.config.url
  );

  await runwithImpersonation(testUser, provider, hre, async (signer: any) => {
    console.log('signer.address', signer.address);

    const howManyLPTokens = hre.ethers.BigNumber.from(
      hre.ethers.utils.parseEther('10')
    );

    const GaugeToUse = UNI_GAUGE_FRAX_IQ_ADDR;

    const uniswapLPToken = new hre.ethers.Contract(
      gauge_lpToken_map(GaugeToUse),
      uniswapV2PairABI,
      signer
    );
    await (await uniswapLPToken.approve(GaugeToUse, howManyLPTokens)).wait(); // aprove the movement of lp tokens for safeTransfer in gauge

    const uniswapGauge = new hre.ethers.Contract(
      GaugeToUse,
      uniswapGaugeABI,
      signer
    );
    await uniswapGauge.stakeLocked(howManyLPTokens, 94608000);
  });
}

stakeLPTokenInGauge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
