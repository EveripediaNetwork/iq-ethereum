import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
  network,
} from 'hardhat';
import {DummyERC20, IQERC20, TokenMinterLimit} from '../typechain';
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
  const PTOKEN = <DummyERC20>await ethers.getContract('DummyERC20');

  await deployments.deploy('TokenMinterLimit', {
    from: deployer,
    args: [
      IQERC20.address,
      PTOKEN.address,
      BigNumber.from(parseEther('100000000')),
    ], // we will start w 100M pIQ limit
    log: true,
  });
  const contracts = {
    TokenMinter: <TokenMinterLimit>await ethers.getContract('TokenMinterLimit'),
    IQERC20: IQERC20,
    PTOKEN: PTOKEN,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('TokenMinterLimit', function () {
  beforeEach(async function () {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
  });
  const TEST_VALUE = BigNumber.from(parseEther('1000'));
  // TODO: test new functions: setLimitWrappedTokens / setCurrentWrappedTokens / test limits hits
  it('TokenMinter can mint and burn', async function () {
    const {users, TokenMinter, deployer} = await setup();
    const user = users[3];
    expect(await TokenMinter.iQ()).to.equal(user.IQERC20.address);
    expect(await TokenMinter.wrappedIQ()).to.equal(user.PTOKEN.address);
    await deployer.PTOKEN.mint(user.address, 5000);
    await expect(deployer.IQERC20.setMinter(TokenMinter.address)).to.be.not
      .reverted;
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);
    expect(await user.PTOKEN.balanceOf(user.address)).to.equal(5000);
    await expect(user.PTOKEN.approve(TokenMinter.address, 1000)).to.be.not
      .reverted;
    await expect(user.TokenMinter.mint(1000)).to.be.not.reverted;
    await expect(user.TokenMinter.mint(1000)).to.be.revertedWith(
      'ERC20: transfer amount exceeds allowance'
    );
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(1000);
    expect(await user.PTOKEN.balanceOf(user.address)).to.equal(4000);
    await expect(user.TokenMinter.burn(2000)).to.be.revertedWith(
      'ERC20: burn amount exceeds balance'
    );
    await expect(user.TokenMinter.burn(1000)).to.not.be.reverted;
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);
    expect(await user.PTOKEN.balanceOf(user.address)).to.equal(5000);
    await expect(users[1].TokenMinter.mint(1000)).to.be.revertedWith(
      'ERC20: transfer amount exceeds balance'
    );

    await expect(user.TokenMinter.burn(-5)).to.be.reverted;
    await expect(user.TokenMinter.mint(-10)).to.be.reverted;
  });

  it('TokenMinter can transfer wrapped', async function () {
    const {users, TokenMinter, deployer} = await setup();
    const user = users[3];
    await deployer.PTOKEN.mint(user.address, 5000);
    await expect(user.PTOKEN.approve(TokenMinter.address, 1000)).to.be.not
      .reverted;
    await expect(deployer.IQERC20.setMinter(TokenMinter.address)).to.be.not
      .reverted;
    await expect(user.TokenMinter.mint(1000)).to.be.not.reverted;
    await expect(
      user.TokenMinter.transferWrapped(user.address, 1000)
    ).to.be.revertedWith('Only IQ owner can tranfer wrapped tokens');
    await expect(
      deployer.TokenMinter.transferWrapped(user.address, 1000)
    ).to.be.revertedWith('Minter is still in use');
    await expect(deployer.IQERC20.setMinter(user.address)).to.be.not.reverted;
    await expect(deployer.TokenMinter.transferWrapped(users[4].address, 500)).to
      .be.not.reverted;
    expect(await user.PTOKEN.balanceOf(users[4].address)).to.equal(500);
    await expect(user.TokenMinter.burn(500)).to.be.revertedWith(
      'You are not owner or minter'
    );
  });

  it('Owner can set limit on wrapped token', async function () {
    const {users, TokenMinter, deployer} = await setup();
    const user = users[2];
    await expect(
      user.TokenMinter.setLimitWrappedTokens(TEST_VALUE)
    ).to.be.revertedWith('Only IQ owner can limit wrapped tokens');
    await expect(deployer.TokenMinter.setLimitWrappedTokens(TEST_VALUE)).to.be
      .not.reverted;
    expect(
      ethers.utils.formatEther(await TokenMinter._limitWrappedTokens())
    ).to.equal('1000.0');
  });

  it('Owner can set current wrapped token', async function () {
    const {users, TokenMinter, deployer} = await setup();
    const user = users[2];
    await expect(
      user.TokenMinter.setCurrentWrappedTokens(TEST_VALUE)
    ).to.be.revertedWith('Only IQ owner can set current wrapped tokens');
    await expect(deployer.TokenMinter.setCurrentWrappedTokens(TEST_VALUE)).to.be
      .not.reverted;
    expect(
      ethers.utils.formatEther(await TokenMinter._currentWrappedTokens())
    ).to.equal('1000.0');
  });
});
