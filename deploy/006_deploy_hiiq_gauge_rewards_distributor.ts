import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const contractName = 'HiIQGaugeRewardsDistributor';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer} = await getNamedAccounts();
  const {deploy} = deployments;

  const result = await deploy(contractName, {
    from: deployer,
    args: [],
    log: true,
  });

  hre.deployments.log(
    `🚀 contract ${contractName} deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};

export default func;
func.tags = ['HiIQGaugeRewardsDistributor'];
