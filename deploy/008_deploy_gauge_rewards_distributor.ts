import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const hiiqGaugeControllerContractName = 'HIIQGaugeController';
const contractName = 'GaugeRewardsDistributor';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deployer} = await getNamedAccounts();
  const {deploy} = deployments;
  const iQ = await deployments.get('IQERC20');
  const hiiqGaugeController = await deployments.get(hiiqGaugeControllerContractName);

  const result = await deploy(contractName, {
    from: deployer,
    args: [
      deployer,
      deployer,
      iQ.address,
      hiiqGaugeController.address,
    ],
    log: true,
  });

  hre.deployments.log(
    `🚀 contract ${contractName} deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};

export default func;
func.tags = ['GaugeRewardsDistributor'];
func.dependencies = ['IQERC20', hiiqGaugeControllerContractName];
