import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'hardhat-typechain';
import 'solidity-coverage';
import '@nomiclabs/hardhat-vyper';
import {node_url, accounts, keys} from './utils/network';
import {utils} from 'ethers';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.7.1',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  vyper: {
    version: '0.2.8',
  },
  namedAccounts: {
    deployer: {
      default: 0,
      mainnet: '0xaCa39B187352D9805DECEd6E73A3d72ABf86E7A0', // IQ deployer
      goerli: '0x59bBEbA0608959D8cC68e7367ca9bF937901b423',
      rinkeby: '0x59bBEbA0608959D8cC68e7367ca9bF937901b423',
    },
    pIQ: {
      default: 1,
      mainnet: '0xa23d33d5e0a61ba81919bfd727c671bb03ab0fea', // pTokens address
      goerli: '0xBFf1365cF0A67431484c00C63bf14cFD9ABBce5D', // dummyERC20
      rinkeby: '0xa8a7e24779a858E756BC94d4b80bfb2adE6EEF84', // dummyERC20
    },
    pTokenHolder: {
      default: '0x9feab70f3c4a944b97b7565bac4991df5b7a69ff', // for testing forking mainnet
    },
    iQ: {
      mainnet: '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9', // everipediaIQ
      matic: '0xB9638272aD6998708de56BBC0A290a1dE534a578', // everipediaIQ
      goerli: '0x0552D756a3E92Aa874EF60F61b7a29030373e869', // everipediaIQ
    },
    hiIQ: {
      default: 2,
      mainnet: '0x1bf5457ecaa14ff63cc89efd560e251e814e16ba',
      matic: '0xfC0fA725E8fB4D87c38EcE56e8852258219C64Ee',
      goerli: '0xc03bcacc5377b7cc6634537650a7a1d14711c1a3',
      rinkeby: '0x279926cca1ccd061ee423c633f7376e2bdecc53a',
    },
    hiIQRewards: {
      goerli: '0x36Cae8d96CBB53e139628e63E47ebe2B47a53f1f',
      rinkeby: '0xBe0B7Dedad660BdEE5CDE49b95a2811Dd6F03E9B',
      mainnet: '0xb55Dcc69d909103b4De773412A22AB8B86e8c602',
    },
    iqFraxLpToken: {
      goerli: '',
      rinkeby: '',
      mainnet: '0xd6c783b257e662ca949b441a4fcb08a53fc49914',
    },
    iqEthLpToken: {
      goerli: '',
      rinkeby: '',
      mainnet: '0xef9f994a74cb6ef21c38b13553caa2e3e15f69d0',
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: "london",
      gasPrice: "auto",
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/Tk-YAWxiKBzTeYyi5vF9IEv4QhFkcMl_",
        blockNumber: 13411630
      },
      // chainId: 31337

      // accounts: accounts(process.env.HARDHAT_FORK),
      // forking: process.env.HARDHAT_FORK
      //   ? {
      //       url: node_url(process.env.HARDHAT_FORK),
      //       blockNumber: process.env.HARDHAT_FORK_NUMBER
      //         ? parseInt(process.env.HARDHAT_FORK_NUMBER)
      //         : undefined,
      //     }
      //   : undefined,
    },
    gaugenet: {
      url: "http://localhost:8545",
      // accounts: [`${PRIVATE_KEY_RINKEBY}`]
    },
    localhost: {
      url: node_url('localhost'),
      accounts: accounts(),
    },
    mainnet: {
      gasPrice: parseInt(utils.parseUnits('80', 'gwei').toString()),
      url: node_url('mainnet'),
      accounts:
        keys('mainnet')[0] !== '' ? keys('mainnet') : accounts('mainnet'),
    },
    rinkeby: {
      gasPrice: parseInt(utils.parseUnits('30', 'gwei').toString()),
      url: node_url('rinkeby'),
      accounts:
        keys('rinkeby')[0] !== '' ? keys('rinkeby') : accounts('rinkeby'),
    },
    kovan: {
      url: node_url('kovan'),
      accounts: accounts('kovan'),
    },
    goerli: {
      gasPrice: parseInt(utils.parseUnits('30', 'gwei').toString()),
      url: node_url('goerli'),
      accounts: keys('goerli')[0] !== '' ? keys('goerli') : accounts('goerli'),
    },
    mumbai: {
      url: node_url('mumbai'),
      accounts: accounts('mumbai'),
    },
    matic: {
      url: node_url('matic'),
      accounts: keys('matic')[0] !== '' ? keys('matic') : accounts('matic'),
    },
    staging: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
    },
  },
  paths: {
    sources: 'src',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 80,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  mocha: {
    timeout: 0,
  },
  external: process.env.HARDHAT_FORK
    ? {
      deployments: {
        hardhat: ['deployments/' + process.env.HARDHAT_FORK],
      },
    }
    : undefined,
};

export default config;
