import {getNamedAccounts, deployments} from 'hardhat';

async function main() {
  const {deployer} = await getNamedAccounts();

  const result = await deployments.deploy('DummyERC20', {
    from: deployer,
    args: [],
    log: true,
  });
  console.log(
    `🚀 contract DummyERC20 deployed at ${result.address} using ${result.receipt?.gasUsed} gas`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
