import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
  network,
} from 'hardhat';
import {DummyERC20, Inflation, IQERC20, TokenMinterLimit} from '../typechain';
import {setupUser, setupUsers} from './utils';
import {parseEther} from 'ethers/lib/utils';
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
    args: [IQERC20.address, []], // TODO: add rewards
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
    /*
    const {users, TokenMinter, deployer} = await setup();
    const user = users[3];
    expect(await TokenMinter.iQ()).to.equal(user.IQERC20.address);
    expect(await TokenMinter.wrappedIQ()).to.equal(user.PTOKEN.address);
    await deployer.PTOKEN.mint(user.address, 5000);
    await expect(deployer.IQERC20.setMinter(TokenMinter.address)).to.be.not
      .reverted;

     */
  });
});
