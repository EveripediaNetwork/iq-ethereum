import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;
  const iQ = await hre.deployments.get('IQERC20');

  // TODO: define array of rewards address and inflation per second.
  const rewards: never[] = [];
  const result = await deploy('Inflation', {
    from: deployer,
    args: [iQ.address, rewards],
    log: true,
  });
  hre.deployments.log(
    `🚀 contract Inflation deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};
export default func;
func.tags = ['Inflation'];
func.dependencies = ['IQERC20'];
