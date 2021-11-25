import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {HIIQGaugeController} from "../typechain";
import {ethers} from "hardhat";
import {parseEther, formatEther} from "ethers/lib/utils";

const contractName = 'HIIQGaugeController';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer, hiIQ} = await getNamedAccounts();
  const {deploy} = deployments;
  const iQ = await deployments.get('IQERC20');

  const HIIQGaugeController = <HIIQGaugeController>await ethers.getContract(contractName, deployer);

  // add gauge liquidity type
  const estGas = await HIIQGaugeController.estimateGas.add_type('Liquidity', 100);
  console.log(`estGas: ${estGas} ${formatEther(estGas)}`)
  await (await HIIQGaugeController.add_type('Liquidity', 100, {gasLimit: estGas})).wait();

  console.log('added type')

  // Change the global emission rate
  const secondsInADay = 60 * 60 * 24;
  const emissionsRateIQperDay = 1e6; // 1M IQ per day
  const yieldPerSecond = parseEther(`${emissionsRateIQperDay}`).div(secondsInADay);
  await (await HIIQGaugeController.change_global_emission_rate(yieldPerSecond)).wait();

  console.log('change_global_emission_rate')
};

export default func;
func.tags = ['HIIQGaugeController'];
func.dependencies = ['IQERC20'];
