import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {GaugeRewardsDistributor, HIIQGaugeController} from "../typechain";
import {ethers} from "hardhat";

const hiiqGaugeControllerContractName = 'HIIQGaugeController';
const gaugeRewardsDistributorContractName = 'GaugeRewardsDistributor';
const contractName = 'StakingRewardsMultiGauge';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer, iqEthLpToken} = await getNamedAccounts();
  const {deploy} = deployments;
  const iQ = await deployments.get('IQERC20');
  const hiiqGaugeController = <HIIQGaugeController>await ethers.getContract(hiiqGaugeControllerContractName, deployer)
  const gaugeRewardsDistributor = <GaugeRewardsDistributor>await ethers.getContract(gaugeRewardsDistributorContractName, deployer)

  const result = await deploy(contractName, {
    from: deployer,
    args: [
      iqEthLpToken,
      gaugeRewardsDistributor.address,
      ['IQ'],
      [iQ.address],
      [deployer],
      [11574074074074],
      ['0x0000000000000000000000000000000000000000'],
    ],
    log: true,
  });

  hre.deployments.log(
    `🚀 contract ${contractName} deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );

  // add the gauge to the gauge controller
  await hiiqGaugeController.add_gauge(result.address, 0, 5000);

  // set the gauge active for the rewards distributor
  await gaugeRewardsDistributor.setGaugeState(result.address, false, true);
};

export default func;
func.tags = ['IQ/ETH Gauge'];
func.dependencies = ['IQERC20', hiiqGaugeControllerContractName, gaugeRewardsDistributorContractName];
