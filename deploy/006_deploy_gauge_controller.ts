import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {HIIQGaugeController} from "../typechain";
import {ethers} from "hardhat";
import {parseEther} from "ethers/lib/utils";

const contractName = 'HIIQGaugeController';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer, hiIQ} = await getNamedAccounts();
  const {deploy} = deployments;
  const iQ = await deployments.get('IQERC20');

  const result = await deploy(contractName, {
    from: deployer,
    args: [iQ.address, hiIQ],
    log: true,
  });

  hre.deployments.log(
    `🚀 contract ${contractName} deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );

  const HIIQGaugeController = <HIIQGaugeController>await ethers.getContract(contractName, deployer);

  // add gauge liquidity type
  await HIIQGaugeController.add_type('Liquidity', 100);

  // Change the global emission rate
  const secondsInADay = 60 * 60 * 24;
  const emissionsRateIQperDay = 1e6; // 1M IQ per day
  const yieldPerSecond = parseEther(`${emissionsRateIQperDay}`).div(secondsInADay);
  await HIIQGaugeController.change_global_emission_rate(yieldPerSecond);
};

export default func;
func.tags = ['HIIQGaugeController'];
func.dependencies = ['IQERC20'];
