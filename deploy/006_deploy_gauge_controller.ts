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
};

export default func;
func.tags = ['HIIQGaugeController'];
func.dependencies = ['IQERC20'];
