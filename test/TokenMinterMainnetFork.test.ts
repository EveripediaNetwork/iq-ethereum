import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
  network,
} from 'hardhat';
import {IERC20, IQERC20, TokenMinter} from '../typechain';
import {setupUser, setupUsers} from './utils';

if (process.env.HARDHAT_FORK) {
  const setup = deployments.createFixture(async () => {
    const {deployer, pIQ, pTokenHolder} = await getNamedAccounts();
    await deployments.fixture();
    const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
    const PTOKEN = <IERC20>await ethers.getContractAt('IERC20', pIQ);

    const contracts = {
      TokenMinter: <TokenMinter>await ethers.getContract('TokenMinter'),
      IQERC20: IQERC20,
      PTOKEN: PTOKEN,
    };
    const users = await setupUsers(await getUnnamedAccounts(), contracts);

    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [pTokenHolder],
    });

    return {
      ...contracts,
      users,
      deployer: await setupUser(deployer, contracts),
      pTokenHolder: await setupUser(pTokenHolder, contracts),
    };
  });

  describe('TokenMinter Forking mainnet', function () {
    it('TokenMinter can mint and burn', async function () {
      const {TokenMinter, deployer, pTokenHolder} = await setup();
      const currentpIQs = '31000000000000000000000';
      await expect(deployer.IQERC20.setMinter(TokenMinter.address)).to.be.not
        .reverted;
      expect(
        await pTokenHolder.PTOKEN.balanceOf(pTokenHolder.address)
      ).to.equal(currentpIQs);

      await expect(
        pTokenHolder.PTOKEN.approve(TokenMinter.address, currentpIQs)
      ).to.be.not.reverted;
      await expect(pTokenHolder.TokenMinter.mint(currentpIQs)).to.be.not
        .reverted;
      expect(
        await pTokenHolder.IQERC20.balanceOf(pTokenHolder.address)
      ).to.equal(currentpIQs);
      expect(
        await pTokenHolder.PTOKEN.balanceOf(pTokenHolder.address)
      ).to.equal(0);
    });
  });
}
