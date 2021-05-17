import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

// if you want to deploy in matic:
// yarn deploy matic --tags PIQSwap
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer, iQ, pIQ} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const result = await deploy('PIQSwap', {
    from: deployer,
    args: [iQ, pIQ],
    log: true,
  });
  hre.deployments.log(
    `🚀 contract PIQSwap deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
};
export default func;
func.tags = ['PIQSwap'];
