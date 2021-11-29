import {expect} from './chai-setup';
import {
  HiIQRewards,
  HIIQGaugeController,
  HIIQ,
  ERC20,
  IQERC20,
} from '../typechain';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
  network,
} from 'hardhat';
import {setupUser, setupUsers} from './utils';
import {BigNumber} from 'ethers';
import {parseEther, formatEther, formatUnits} from 'ethers/lib/utils';
import {contractAddress} from '../scripts/fork/util_functions'; // gauges helper functions

// BEGIN - helper functions

async function runwithImpersonation(userAddress: any, func: any) {
  const signerImpersonate = await ethers.getSigner(userAddress);

  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [userAddress],
  });

  await func(signerImpersonate);

  await network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [userAddress],
  });
}

async function getGaugeWeights(HiIQGaugeController: any, checkWeights: any = false) {
  const numberOfGauges = await HiIQGaugeController.n_gauges();
  !checkWeights && console.log(`there are ${numberOfGauges} gauges in this gaugecontroller`);

  let totalWeight = await HiIQGaugeController.get_total_weight();
  for (let g_idx = 0; g_idx < numberOfGauges; g_idx++) {
    const gaugeAddress = await HiIQGaugeController.gauges(g_idx);
    const gaugeWeight = await HiIQGaugeController.get_gauge_weight(gaugeAddress);
    const gaugeWeightPct = (Number(formatUnits(gaugeWeight, 18)) / Number(formatUnits(totalWeight, 18))) * 10000;
    !checkWeights && console.log(`${gaugeAddress} - ${formatUnits(gaugeWeight, 2)} ${gaugeWeightPct} %`);
    !checkWeights && console.log(`totalWeight: ${formatUnits(totalWeight, 2)}`);
    if (checkWeights && checkWeights[gaugeAddress]) {
      expect(gaugeWeightPct).to.be.gt(checkWeights[gaugeAddress].low);
      expect(gaugeWeightPct).to.be.lt(checkWeights[gaugeAddress].high);
    }
  }
}

function timestampToString(timestamp: any) {
  const timestampDate = new Date(timestamp * 1000);
  return `${timestampDate.toLocaleDateString('en-US')} ${timestampDate.toLocaleTimeString('en-US')}`;
}

async function outputBlockTimestamp() {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  let blockTimestampStr = timestampToString(block.timestamp)
  console.log('\n===============================================');
  console.log(`block timestamp: ${blockTimestampStr}`);
}

// END - helper functions

const secondsInADay = 24 * 60 * 60;

const IQERC20ABI = require('../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;
const hiIQABI = require('../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
const hiIQRewardsABI = require('../artifacts/src/Rewards/HiIQRewardsv4.sol/HiIQRewardsv4').abi;
const uniswapV2PairABI = require('../artifacts/src/Interfaces/IUniswapV2Pair.sol/IUniswapV2Pair').abi;

const IQERC20MainnetAddress = contractAddress('IQ');
const hiIQMainnetAddress = contractAddress('HIIQ');
const hiIQRewardsMainnetAddress = '0xb55Dcc69d909103b4De773412A22AB8B86e8c602';
const iqFraxLpToken = contractAddress('UNISWAP_LP_IQ_FRAX');
const iqEthLpToken = contractAddress('UNISWAP_LP_IQ_ETH');

// contracts to deploy
const hiIQGaugeController = 'HIIQGaugeController';
const stakingRewardsMultiGauge = 'StakingRewardsMultiGauge';
const GaugeRewardsDistributor = 'GaugeRewardsDistributor';

const setup = deployments.createFixture(async () => {
  const {deployer} = await getNamedAccounts();
  const HIIQ = new ethers.Contract(hiIQMainnetAddress, hiIQABI); // await ethers.getContract('HIIQ');
  const IQERC20 = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI); // await ethers.getContract('IQERC20');
  const HiIQRewards = new ethers.Contract(hiIQRewardsMainnetAddress, hiIQRewardsABI);

  const UniswapFraxIqPool = new ethers.Contract(iqFraxLpToken, uniswapV2PairABI);
  const UniswapEthIqPool = new ethers.Contract(iqEthLpToken, uniswapV2PairABI);

  console.log('deploying hiIQGaugeController');
  await deployments.deploy(hiIQGaugeController, {
    from: deployer,
    args: [IQERC20.address, HIIQ.address],
    log: true,
  });

  const HiIQGaugeController = await ethers.getContract(hiIQGaugeController);

  console.log('add gauge type');
  const estGas1 = await HiIQGaugeController.estimateGas.add_type('Liquidity', 100);
  await HiIQGaugeController.add_type(0, 100, {gasLimit: estGas1});

  // Change the global emission rate
  const emissionsRateIQperDay = 1e6; // 1M IQ per day
  const yieldPerSecond = parseEther(`${emissionsRateIQperDay}`).div(secondsInADay);
  await HiIQGaugeController.change_global_emission_rate(yieldPerSecond);

  console.log('deploying gauge rewards distributor');
  const gaugeRewardsDist = await deployments.deploy(
    GaugeRewardsDistributor,
    {
      from: deployer,
      args: [
        deployer,
        deployer,
        IQERC20.address,
        HiIQGaugeController.address,
      ],
      log: true,
    }
  );

  const RewardsDistributor = await ethers.getContract(GaugeRewardsDistributor);


  console.log('deploying uniswap lp IQ/FRAX gauge');
  const uniswap_lp_iq_frax_gauge = await deployments.deploy(
    stakingRewardsMultiGauge,
    {
      from: deployer,
      args: [
        iqFraxLpToken,
        gaugeRewardsDist.address,
        ['IQ'],
        [IQERC20.address],
        [deployer],
        [11574074074074],
        [HiIQGaugeController.address], // ['0x0000000000000000000000000000000000000000'],
      ],
      log: true,
    }
  );

  console.log('add uniswap lp IQ/FRAX gauge to gaugecontroller');
  await HiIQGaugeController.add_gauge(uniswap_lp_iq_frax_gauge.address, 0, 5000);

  console.log('deploying uniswap lp IQ/ETH gauge');
  const uniswap_lp_iq_eth_gauge = await deployments.deploy(
    stakingRewardsMultiGauge,
    {
      from: deployer,
      args: [
        iqEthLpToken,
        gaugeRewardsDist.address,
        ['IQ'],
        [IQERC20.address],
        [deployer],
        [11574074074074],
        [HiIQGaugeController.address], // ['0x0000000000000000000000000000000000000000'],
      ],
      log: true,
    }
  );

  console.log('add uniswap lp IQ/FRAX gauge to gaugecontroller');
  await HiIQGaugeController.add_gauge(uniswap_lp_iq_eth_gauge.address, 0, 5000);

  const UniswapIqFraxLpGauge = await ethers.getContractAt(stakingRewardsMultiGauge, uniswap_lp_iq_frax_gauge.address);
  const UniswapIqEthLpGauge = await ethers.getContractAt(stakingRewardsMultiGauge, uniswap_lp_iq_eth_gauge.address);

  console.log('rewards dist whitelist gauged');
  await RewardsDistributor.setGaugeState(UniswapIqFraxLpGauge.address, false, true);
  await RewardsDistributor.setGaugeState(UniswapIqEthLpGauge.address, false, true);

  const contracts = {
    HiIQRewards,
    HIIQ,
    IQERC20,
    HiIQGaugeController,
    RewardsDistributor,
    UniswapFraxIqPool,
    UniswapEthIqPool,
    UniswapIqFraxLpGauge,
    UniswapIqEthLpGauge,
  };

  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

const setupUserFunds = async (setupResults: any, outputDebug: boolean = false) => {

  const {
    users,
    HIIQ,
    HiIQRewards,
    HiIQGaugeController,
    RewardsDistributor,
    UniswapFraxIqPool,
    UniswapEthIqPool,
    UniswapIqFraxLpGauge,
    UniswapIqEthLpGauge,
  } = setupResults

  const ownerAddr = contractAddress('OWNER');

  const user = users[0];
  const lockTime = Math.round(new Date().getTime() / 1000) + secondsInADay * 60; // 60 days

  const amount = BigNumber.from(parseEther('60000000')); // 60M
  const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
  const rewardAmount = BigNumber.from(parseEther('30000000')); // 30M

  let estGas;

  // "borrows" LP Tokens from user
  async function getIqEthLPTokens(toAddress: any, amount: any) {
    let estGas;
    const fromAddress = '0x44C45d538435CFD6abB7a995bd1b3C2571f70bC8'; // holding LP tokens
    await runwithImpersonation(
      fromAddress,
      async (signerImpersonate: any) => {
        const UniswapFraxIqPool = new ethers.Contract(iqFraxLpToken, uniswapV2PairABI, signerImpersonate);
        const howManyLPTokens = ethers.BigNumber.from(ethers.utils.parseEther(`${amount}`));
        const estGas = await UniswapFraxIqPool.estimateGas.transfer(toAddress, howManyLPTokens);
        const tx = await UniswapFraxIqPool.transfer(toAddress, howManyLPTokens, {gasLimit: estGas});
        await tx.wait();
      }
    );
  }

  // give some IQ to the hardhat users
  async function getIQandHIIQ(userToFund: any) {
    let estGas;

    await runwithImpersonation(ownerAddr, async (signerImpersonate: any) => {
      const IQERC20Local = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signerImpersonate);

      outputDebug && console.log('before Balance:', formatEther(await IQERC20Local.balanceOf(userToFund.address)));

      estGas = await IQERC20Local.estimateGas.mint(userToFund.address, amount);
      const tx = await IQERC20Local.mint(userToFund.address, amount, {gasLimit: estGas,});
      await tx.wait();

      outputDebug && console.log('after Balance:', formatEther(await IQERC20Local.balanceOf(userToFund.address)));
    });

    // lock 1M IQ for 60 days, give user HiIQ
    estGas = await userToFund.IQERC20.estimateGas.approve(HIIQ.address, lockedAmount);
    await userToFund.IQERC20.approve(HIIQ.address, lockedAmount, {gasLimit: estGas,});

    estGas = await userToFund.HIIQ.estimateGas.create_lock(lockedAmount, lockTime);
    await userToFund.HIIQ.create_lock(lockedAmount, lockTime, {gasLimit: estGas,});

    estGas = await userToFund.HIIQ.estimateGas.checkpoint();
    await userToFund.HIIQ.checkpoint({gasLimit: estGas});
  }

  // fund the rewards distributor
  await runwithImpersonation(ownerAddr, async (signerImpersonate: any) => {
    const IQERC20Local = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signerImpersonate);

    // rewards distributor
      estGas = await IQERC20Local.estimateGas.mint(RewardsDistributor.address, amount);
      (await IQERC20Local.mint(RewardsDistributor.address, amount, {gasLimit: estGas,})).wait();

    //gauge 1
    estGas = await IQERC20Local.estimateGas.mint(UniswapIqFraxLpGauge.address, amount);
    (await IQERC20Local.mint(UniswapIqFraxLpGauge.address, amount, {gasLimit: estGas,})).wait();

    //gauge 2
    estGas = await IQERC20Local.estimateGas.mint(UniswapIqEthLpGauge.address, amount);
    (await IQERC20Local.mint(UniswapIqEthLpGauge.address, amount, {gasLimit: estGas,})).wait();

    outputDebug && console.log('RewardsDistributor Balance:', formatEther(await IQERC20Local.balanceOf(RewardsDistributor.address)));
  });

  await getIQandHIIQ(users[0]);
  await getIQandHIIQ(users[1]);
  await getIQandHIIQ(users[2]);

  await getIqEthLPTokens(users[0].address, 100); // get some LP Tokens
}

describe('CRV Gauges', () => {
  it('Weight Voting Test', async () => {
      const setupResults = await setup();
      const {
        users,
        deployer,
        IQERC20,
        HIIQ,
        HiIQRewards,
        HiIQGaugeController,
        RewardsDistributor,
        UniswapFraxIqPool,
        UniswapEthIqPool,
        UniswapIqFraxLpGauge,
        UniswapIqEthLpGauge,
      } = setupResults

      await setupUserFunds(setupResults);

      console.log('HiIQGaugeController', HiIQGaugeController.address);

      let blockNum = await ethers.provider.getBlockNumber();
      const user0HiIQBalance = await users[0].HIIQ['balanceOfAt(address,uint256)'](users[0].address, blockNum);
      console.log(`user0HiIQBalance: ${user0HiIQBalance}`);

      // await outputBlockTimestamp();
      await getGaugeWeights(HiIQGaugeController, {
        [`${UniswapIqFraxLpGauge.address}`]: {low: 40, high: 60},
        [`${UniswapIqEthLpGauge.address}`]: {low: 40, high: 60}
      });

      console.log(`balance HIIQ ${await users[0].HIIQ['balanceOf(address)'](users[0].address)}`)

      // vote for IQ/FRAX gauge 20% and IQ/ETH gauge 80%
      await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 2000);
      await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 8000);


      const vote_user_slopes = await HiIQGaugeController.vote_user_slopes(users[0].address, UniswapIqFraxLpGauge.address);
      console.log(`vote_user_slopes: ${vote_user_slopes}`);

      // await outputBlockTimestamp();
      await getGaugeWeights(HiIQGaugeController, {
        [`${UniswapIqFraxLpGauge.address}`]: {low: 19, high: 21},
        [`${UniswapIqEthLpGauge.address}`]: {low: 79, high: 81}
      });

      console.log(`balance HIIQ ${await users[1].HIIQ['balanceOf(address)'](users[1].address)}`)

      // vote for IQ/FRAX gauge 30% and IQ/ETH gauge 70%
      await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 3000);
      await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 7000);

      // await outputBlockTimestamp();
      await getGaugeWeights(HiIQGaugeController, {
        [`${UniswapIqFraxLpGauge.address}`]: {low: 24, high: 26},
        [`${UniswapIqEthLpGauge.address}`]: {low: 74, high: 76}
      });

      console.log(`balance HIIQ ${await users[2].HIIQ['balanceOf(address)'](users[2].address)}`)

      // vote for IQ/FRAX gauge 40% and IQ/ETH gauge 60%
      await users[2].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 4000);
      await users[2].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 6000);

      // await outputBlockTimestamp();
      await getGaugeWeights(HiIQGaugeController, {
        [`${UniswapIqFraxLpGauge.address}`]: {low: 29, high: 31},
        [`${UniswapIqEthLpGauge.address}`]: {low: 69, high: 71}
      });

      let useVotingPowerUsed = formatUnits(await HiIQGaugeController.vote_user_power(users[0].address), 2);
      console.log(`User Voting Power Used: ${useVotingPowerUsed} %`); // format for bps

      const IqFraxTimeWeight = await HiIQGaugeController.time_weight(UniswapIqFraxLpGauge.address);
      console.log(`IqFraxTimeWeight: ${new Date(IqFraxTimeWeight * 1000).toLocaleDateString('en-US')}`);

      // vote for IQ/FRAX gauge 50% and IQ/ETH gauge 50%
      await expect(users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 5000)).to.be.revertedWith('Cannot vote so often');
      await expect(users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 5000)).to.be.revertedWith('Cannot vote so often');

      await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]);
      await ethers.provider.send('evm_mine', []);

      await (await HiIQGaugeController.checkpoint()).wait();

      await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 4500);
      await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 4500);
      // await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 5000);
      // await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 5000);

      // await outputBlockTimestamp();
      await getGaugeWeights(HiIQGaugeController, {
        [`${UniswapIqFraxLpGauge.address}`]: {low: 39, high: 41},
        [`${UniswapIqEthLpGauge.address}`]: {low: 59, high: 61}
      });

      useVotingPowerUsed = formatUnits(await HiIQGaugeController.vote_user_power(users[0].address), 2);
      expect(useVotingPowerUsed).to.be.eq('90.0'); // expect 10% left over after the changed votes
      console.log(`User Voting Power Used: ${useVotingPowerUsed} %`); // format for bps

    }
  );

  it('Wasted Voting Weight', async () => {
    const setupResults = await setup();
    const {
      users,
      deployer,
      IQERC20,
      HIIQ,
      HiIQRewards,
      HiIQGaugeController,
      RewardsDistributor,
      UniswapFraxIqPool,
      UniswapEthIqPool,
      UniswapIqFraxLpGauge,
      UniswapIqEthLpGauge,
    } = setupResults

    await setupUserFunds(setupResults);

    // vote for IQ/FRAX gauge 1% and IQ/ETH gauge 1%
    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 100);
    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 100);

    const useVotingPowerUsed = formatUnits(await HiIQGaugeController.vote_user_power(users[0].address), 2);
    expect(useVotingPowerUsed).to.be.eq('2.0'); // expect 10% left over after the changed votes
    console.log(`User Voting Power Used: ${useVotingPowerUsed} %`); // format for bps

    // you still have 98% voting power to use but you've already voted
    await expect(users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 5000)).to.be.revertedWith('Cannot vote so often');
    await expect(users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 5000)).to.be.revertedWith('Cannot vote so often');

    // Need to express this to the UI properly! reclaiming voting power and increasing weights somewhere else

  });

  it('Rewards Test', async () => {
    const setupResults = await setup();
    const {
      users,
      deployer,
      IQERC20,
      HIIQ,
      HiIQRewards,
      HiIQGaugeController,
      RewardsDistributor,
      UniswapFraxIqPool,
      UniswapEthIqPool,
      UniswapIqFraxLpGauge,
      UniswapIqEthLpGauge,
    } = setupResults

    await setupUserFunds(setupResults);

    // vote for IQ/FRAX gauge 50% and IQ/ETH gauge 50%
    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 5000);
    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 5000);

    await outputBlockTimestamp();
    await getGaugeWeights(HiIQGaugeController);

    // Stake LP Tokens in the UniswapV2 Gauge
    const amountLockLPTokens = ethers.BigNumber.from(ethers.utils.parseEther('10'));
    await (await users[0].UniswapFraxIqPool.approve(UniswapIqFraxLpGauge.address, amountLockLPTokens)).wait(); // aprove the movement of lp tokens for safeTransfer in gauge
    await users[0].UniswapIqFraxLpGauge.stakeLocked(amountLockLPTokens, 3 * 365 * 24 * 60 * 60)//94608000);

    console.log(`fraxPerLPToken: ${await UniswapIqFraxLpGauge.iqPerLPToken()}`);
    const gControllerEmissionRate = await HiIQGaugeController.global_emission_rate();
    const userStakedIq = await UniswapIqFraxLpGauge.userStakedIq(users[0].address);
    const lockedLiquidity = await UniswapIqFraxLpGauge.lockedLiquidityOf(users[0].address);
    console.log(`userStakedIq: ${userStakedIq}`);
    console.log(`lockedLiquidity: ${lockedLiquidity}`);
    console.log(`gControllerEmissionRate: ${gControllerEmissionRate}`);

    // console.log('')
    // console.log(JSON.stringify(await UniswapIqFraxLpGauge.lockedStakesOf(users[0].address)))
    // console.log('')

    await UniswapIqFraxLpGauge.sync();
    await outputBlockTimestamp();
    console.log(`periodFinish: ${timestampToString(await UniswapIqFraxLpGauge.periodFinish())}`)
    let user0Earned = await users[0].UniswapIqFraxLpGauge.earned(users[0].address);
    console.log(`user0Earned: ${formatEther(user0Earned[0])}`);

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]);
    await ethers.provider.send('evm_mine', []);


    await UniswapIqFraxLpGauge.sync();
    await outputBlockTimestamp();
    console.log(`periodFinish: ${timestampToString(await UniswapIqFraxLpGauge.periodFinish())}`)
    user0Earned = await users[0].UniswapIqFraxLpGauge.earned(users[0].address);
    console.log(`user0Earned: ${formatEther(user0Earned[0])}`);

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]);
    await ethers.provider.send('evm_mine', []);

    await UniswapIqFraxLpGauge.sync();
    await outputBlockTimestamp();
    console.log(`periodFinish: ${timestampToString(await UniswapIqFraxLpGauge.periodFinish())}`)
    user0Earned = await UniswapIqFraxLpGauge.earned(users[0].address);
    console.log(`user0Earned: ${formatEther(user0Earned[0])}`);
  });
});
