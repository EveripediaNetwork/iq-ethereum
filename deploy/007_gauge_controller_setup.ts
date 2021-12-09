import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {HIIQGaugeController} from "../typechain";
import {ethers} from "hardhat";
import {BigNumber} from 'ethers';
import {parseEther, formatEther} from "ethers/lib/utils";

const contractName = 'HIIQGaugeController';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

  return; // SKIP THIS WHOLE THING

  const {deployments, getNamedAccounts} = hre;
  const {deployer} = await getNamedAccounts();
  const {deploy} = deployments;
  const iQ = await deployments.get('IQERC20');

  const HIIQGaugeController = <HIIQGaugeController>await ethers.getContract(contractName, deployer);

  if ((await HIIQGaugeController.n_gauge_types({gasLimit: 250000})) > BigNumber.from('0')) {
    hre.deployments.log('GaugeController is already set up!');
    return;
  }

  // add gauge liquidity type
  const estGas = await HIIQGaugeController.estimateGas.add_type('Liquidity', 100);
  hre.deployments.log(`estGas: ${estGas} ${formatEther(estGas)}`)
  await (await HIIQGaugeController.add_type('Liquidity', 100, {gasLimit: estGas})).wait();

  hre.deployments.log('added type')

  // Change the global emission rate
  const secondsInADay = 60 * 60 * 24;
  const emissionsRateIQperDay = 1e6; // 1M IQ per day
  const yieldPerSecond = parseEther(`${emissionsRateIQperDay}`).div(secondsInADay);
  await (await HIIQGaugeController.change_global_emission_rate(yieldPerSecond)).wait();

  hre.deployments.log('change_global_emission_rate')
};

export default func;
func.tags = ['HIIQGaugeController'];
func.dependencies = ['IQERC20'];
