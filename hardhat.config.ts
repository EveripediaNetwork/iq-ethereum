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
    version: '0.7.1',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
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
      matic: '0xa23d33d5e0a61ba81919bfd727c671bb03ab0fea', // pTokens address TODO: add
    },
    pTokenHolder: {
      default: '0x9feab70f3c4a944b97b7565bac4991df5b7a69ff', // for testing forking mainnet
    },
    iQ: {
      default: 2,
      mainnet: '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9', // everipediaIQ
      matic: '0xB9638272aD6998708de56BBC0A290a1dE534a578', // everipediaIQ
    },
  },
  networks: {
    hardhat: {
      accounts: accounts(process.env.HARDHAT_FORK),
      forking: process.env.HARDHAT_FORK
        ? {
            url: node_url(process.env.HARDHAT_FORK),
            blockNumber: process.env.HARDHAT_FORK_NUMBER
              ? parseInt(process.env.HARDHAT_FORK_NUMBER)
              : undefined,
          }
        : undefined,
    },
    localhost: {
      url: node_url('localhost'),
      accounts: accounts(),
    },
    mainnet: {
      gasPrice: parseInt(utils.parseUnits('123', 'gwei').toString()),
      url: node_url('mainnet'),
      accounts:
        keys('mainnet')[0] !== '' ? keys('mainnet') : accounts('mainnet'),
    },
    rinkeby: {
      gasPrice: parseInt(utils.parseUnits('123', 'gwei').toString()),
      url: node_url('rinkeby'),
      accounts:
        keys('rinkeby')[0] !== '' ? keys('rinkeby') : accounts('rinkeby'),
    },
    kovan: {
      url: node_url('kovan'),
      accounts: accounts('kovan'),
    },
    goerli: {
      gasPrice: parseInt(utils.parseUnits('123', 'gwei').toString()),
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
    gasPrice: 185,
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
