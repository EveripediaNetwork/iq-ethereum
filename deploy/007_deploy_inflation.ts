import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;
  const iQ = await hre.deployments.get('IQERC20');

  // emissions based on https://snapshot.everipedia.com/#/proposal/0x0b94293b4e55339b5fb0cacb2fab54590656913171eef4cb0ad17e139304cdbd
  // -----
  // 4.3M IQ will be minted and used to acquire Ethereum, stablecoins, and other assets for the BrainDAO treasury
  // \-> 50.15 IQ per second to IQ deployer
  // 3M IQ will be minted each day for HiIQ stakers
  // \-> 34.72 IQ per second to HiIQ Rewards
  // 3M IQ will be minted each day and allocated to the IQ.wiki company
  // \-> 34.72 IQ per second to Company address
  // 1M IQ will be minted each day to provide rewards for our upcoming NFT gauges
  // \-> 11.57 IQ per second to BrainDAO
  // 350,000 IQ will be minted each day to provide rewards for editors
  // \-> 4.05 IQ per second to BrainDAO
  // 250,000 IQ will be minted each day to incentivize liquidity FRAX-IQ
  // \-> 2.89 IQ per second to FRAX-IQ Rewards
  // -----
  // last minting: Nov 17th - 3 months HiIQ & FRAX-IQ incentivization
  // last minting: Nov 20th - 1 month IQ Bonds
  // last minting: Nov 30th - 45 days left fraxswap FRAX-IQ
  // last minting: Not yet ( company, NFT, editors )

  const secondsInADay = 86400;
  const rewards: never[] = [];
  const result = await deploy('Inflation', {
    from: deployer,
    args: [iQ.address, rewards, deployer],
    log: true,
  });
  hre.deployments.log(
    `🚀 contract Inflation deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};
export default func;
func.tags = ['Inflation'];
