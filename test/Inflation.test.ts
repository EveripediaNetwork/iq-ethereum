import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
  network,
} from 'hardhat';
import {DummyERC20, Inflation, IQERC20} from '../typechain';
import {setupUser, setupUsers} from './utils';
import {BigNumber} from 'ethers';

const setup = deployments.createFixture(async () => {
  const {deployer} = await getNamedAccounts();
  await deployments.fixture();
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  await deployments.deploy('DummyERC20', {
    from: deployer,
    args: [],
    log: true,
  });

  await deployments.deploy('Inflation', {
    from: deployer,
    args: [IQERC20.address, [], deployer],
    log: true,
  });
  const contracts = {
    Inflation: <Inflation>await ethers.getContract('Inflation'),
    IQERC20: IQERC20,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('Inflation', function () {
  beforeEach(async function () {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
  });
  //TODO: add tests
  it('Inflation can inflate', async function () {
    const {users, deployer} = await setup();
    console.log(await deployer.Inflation.rewards());
    await deployer.Inflation.changeInflation([
      {
        destination: users[0].address,
        emissionsPerSecond: BigNumber.from('1000000000000000000'),
      },
    ]);
    console.log(await deployer.Inflation.rewards());
    // TODO: test change inflation, permissions, rescue, inflate
  });
});
