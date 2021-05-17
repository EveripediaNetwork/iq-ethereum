import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {DummyERC20, IQERC20, PIQSwap} from '../typechain';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  const {deployer} = await getNamedAccounts();
  await deployments.fixture('IQERC20');
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  await deployments.deploy('DummyERC20', {
    from: deployer,
    args: [],
    log: true,
  });
  const PTOKEN = <DummyERC20>await ethers.getContract('DummyERC20');

  await deployments.deploy('PIQSwap', {
    from: deployer,
    args: [IQERC20.address, PTOKEN.address],
    log: true,
  });

  const contracts = {
    IQERC20: IQERC20,
    PTOKEN: PTOKEN,
    PIQSwap: <PIQSwap>await ethers.getContract('PIQSwap'),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('PIQSwap', function () {
  it('PIQSwap can swap 1 pIQ for 1 IQ', async function () {
    const {users, PIQSwap, deployer} = await setup();
    const amount = 10000;
    await expect(deployer.IQERC20.mint(users[0].address, amount)).to.be.not
      .reverted;
    await expect(deployer.PTOKEN.mint(users[0].address, amount)).to.be.not
      .reverted;
    await expect(users[0].PTOKEN.transfer(PIQSwap.address, amount)).to.be.not
      .reverted;
    await expect(users[0].IQERC20.approve(PIQSwap.address, amount)).to.be.not
      .reverted;
    await expect(users[0].PIQSwap.getpIQ(1000)).to.be.not.reverted;

    expect(await users[0].IQERC20.balanceOf(users[0].address)).to.equal(9000);
    expect(await users[0].IQERC20.balanceOf(PIQSwap.address)).to.equal(1000);
    expect(await users[0].PTOKEN.balanceOf(users[0].address)).to.equal(1000);
    expect(await users[0].PTOKEN.balanceOf(PIQSwap.address)).to.equal(9000);
  });

  it('PIQSwap deployer can recover funds', async function () {
    const {users, PIQSwap, PTOKEN, deployer} = await setup();
    const amount = 10000;
    await expect(deployer.PTOKEN.mint(users[0].address, amount)).to.be.not
      .reverted;
    await expect(users[0].PTOKEN.transfer(PIQSwap.address, amount)).to.be.not
      .reverted;
    await expect(
      users[0].PIQSwap.recover(PTOKEN.address, users[0].address, amount)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      deployer.PIQSwap.recover(PTOKEN.address, users[0].address, amount)
    ).to.be.not.reverted;

    expect(await users[0].PTOKEN.balanceOf(users[0].address)).to.equal(amount);
    expect(await users[0].PTOKEN.balanceOf(PIQSwap.address)).to.equal(0);
  });
});
