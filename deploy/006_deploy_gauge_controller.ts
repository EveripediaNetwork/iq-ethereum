import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {HIIQGaugeController} from "../typechain";
import {ethers} from "hardhat";
import {parseEther, formatEther} from "ethers/lib/utils";

const contractName = 'HIIQGaugeController';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer, hiIQ, hiIQGaugeController} = await getNamedAccounts();
  const {deploy} = deployments;
  const iQ = await deployments.get('IQERC20');

  console.log('IQ address:', iQ.address);
  console.log('hiIQ address:', hiIQ);

  if (hiIQGaugeController) {
    hre.deployments.log(`🚀 found contract hiIQGaugeController in namedAccounts at ${hiIQGaugeController}`)
    return;
  }

  const result = await deploy(contractName, {
    from: deployer,
    args: [iQ.address, hiIQ],
    log: true,
  });

  hre.deployments.log(
    `🚀 contract ${contractName} deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );

  if (result.newlyDeployed) {
    const HIIQGaugeController = <HIIQGaugeController>await ethers.getContract(contractName, deployer);

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
  }
};

export default func;
func.tags = ['HIIQGaugeController'];
func.dependencies = ['IQERC20'];
