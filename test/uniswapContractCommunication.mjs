import { NonfungiblePositionManager } from "@uniswap/v3-sdk"
import { Fraction } from "@uniswap/sdk"
import { Position } from "@uniswap/v3-sdk"
import { AlphaRouter } from '@uniswap/smart-order-router'
import { Token, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import { ethers, BigNumber } from 'ethers'
import { Pool } from '@uniswap/v3-sdk'
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const abi = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json')
import JSBI  from 'jsbi' // jsbi@3.2.5)
import { SwapToRatioStatus } from "@uniswap/smart-order-router"
import fetch from "node-fetch" // node-fetch@1.7.3

const V3_SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const V3_NFT_POS_MANAGER_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

// require('dotenv').config()
// const WALLET_ADDRESS = process.env.WALLET_ADDRESS
// const WALLET_SECRET = process.env.WALLET_SECRET
// const ALCHEMY_API = process.env.ALCHEMY_API

// polygon
// const web3Provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/6aCuWP8Oxcd-4jvmNYLh-WervViwIeJq')
// const chainId = 137
// const Token0 = new Token(
//   chainId,
//   '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
//   18,
//   'WMATIC',
//   'Wrapped Matic'
// );
// const Token1 = new Token(
//     chainId,
//     '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
//     6,
//     'USDT',
//     'Tether USD'
// );
// const tokenForAAVE = new Token(
//     chainId,
//     '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
//     6,
//     'USDC',
//     'USD Coin'
// );
// const poolAddress = '0x9B08288C3Be4F62bbf8d1C20Ac9C5e6f9467d8B7'
// const url = 'https://gasstation-mainnet.matic.network/v2';

// mainnet fork
const web3Provider = new ethers.providers.JsonRpcProvider( 'http://127.0.0.1:8545/')
const chainId = 1
const Token0 = new Token(
    chainId,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    18,
    'WETH',
    'Wrapped Ether'
);
const Token1 = new Token(
    chainId,
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    6,
    'USDT',
    'Tether USD'
);
const poolAddress = '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36'

const ERC20ABI = require('../abi/ERC20ABI.json')
const token0Contract = new ethers.Contract(Token0.address, ERC20ABI, web3Provider)
const token1Contract = new ethers.Contract(Token1.address, ERC20ABI, web3Provider)
// const tokenForAAVEContract = new ethers.Contract(tokenForAAVE.address, ERC20ABI, web3Provider)

const router = new AlphaRouter({ chainId: chainId, provider: web3Provider})

const poolContract = new ethers.Contract(poolAddress, abi.abi, web3Provider)

async function getPoolImmutables() {
    const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] = await Promise.all([
        poolContract.factory(),
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.maxLiquidityPerTick(),
    ])

    return {
        factory,
        token0,
        token1,
        fee,
        tickSpacing,
        maxLiquidityPerTick,
    }
}

async function getPoolState() {
    const liquidity = await poolContract.liquidity();
    const slot = await poolContract.slot0();

    return {
        liquidity,
        sqrtPriceX96: slot[0],
        tick: slot[1],
        observationIndex: slot[2],
        observationCardinality: slot[3],
        observationCardinalityNext: slot[4],
        feeProtocol: slot[5],
        unlocked: slot[6],
    };
}

async function swapAndAdd(width, token0Amount, token1Amount, WALLET_ADDRESS, WALLET_SECRET) {
    token0Amount = Number(token0Amount).toFixed(Token0.decimals)
    token1Amount = Number(token1Amount).toFixed(Token1.decimals)
    const token0Balance = CurrencyAmount.fromRawAmount(Token0, JSBI.BigInt(ethers.utils.parseUnits(String(token0Amount), Token0.decimals)))
    const token1Balance = CurrencyAmount.fromRawAmount(Token1, JSBI.BigInt(ethers.utils.parseUnits(String(token1Amount), Token1.decimals)))

    const wallet = new ethers.Wallet(WALLET_SECRET)
    const connectedWallet = wallet.connect(web3Provider)

    const [immutables, state] = await Promise.all([getPoolImmutables(), getPoolState()])
    // console.log(immutables)
    // console.log(state)

    const poolExample = new Pool(
        Token0,
        Token1,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick,
    )
    // console.log(poolExample)

    const position = new Position({
        pool: poolExample,
        tickLower: state.tick - width * immutables.tickSpacing - ((state.tick - width * immutables.tickSpacing) % immutables.tickSpacing),
        tickUpper: state.tick + width * immutables.tickSpacing + (immutables.tickSpacing - (state.tick + width * immutables.tickSpacing) % immutables.tickSpacing),
        liquidity: 1,
    })
    // console.log(position)

    const routeToRatioResponse = await router.routeToRatio(
        token0Balance,
        token1Balance,
        position,
        {
            ratioErrorTolerance: new Fraction(5, 100),
            // maxIterations: 10,
        },
        {
            swapOptions: {
                recipient: WALLET_ADDRESS,
                slippageTolerance: new Percent(4, 100),
                deadline: Math.round(Date.now() / 1000) + 300,
            },
            addLiquidityOptions: {
                recipient: WALLET_ADDRESS
            }
        }
    );
    // console.log(routeToRatioResponse)

    if (routeToRatioResponse.status === SwapToRatioStatus.SUCCESS) {
        const route = routeToRatioResponse.result

        // const approvalAmount0 = ethers.utils.parseUnits((token0Amount).toString(), Token0.decimals).toString()
        // await token0Contract.connect(connectedWallet).approve(
        //     V3_SWAP_ROUTER_ADDRESS,
        //     ethers.constants.MaxUint256,
        //     {
        //         gasPrice: web3Provider.getGasPrice(),
        //         gasLimit: BigNumber.from('100000')
        //     }
        // )

        // const approvalAmount1 = ethers.utils.parseUnits((token1Amount).toString(), Token1.decimals).toString()
        // await token1Contract.connect(connectedWallet).approve(
        //     V3_SWAP_ROUTER_ADDRESS,
        //     ethers.constants.MaxUint256,
        //     {
        //         gasPrice: web3Provider.getGasPrice(),
        //         gasLimit: BigNumber.from('100000')
        //     }
        // )

        const transaction = {
            data: route.methodParameters.calldata,
            to: V3_SWAP_ROUTER_ADDRESS,
            value: BigNumber.from(route.methodParameters.value),
            from: WALLET_ADDRESS,
            gasPrice: await web3Provider.getGasPrice(),
            gasLimit: BigNumber.from('3000000')
        };

        return await connectedWallet.sendTransaction(transaction).then(function(transaction) {
            return transaction.wait();
        })
    }

}

// async function getGasPrice(url){
//     return await fetch(url)
//         .then(response => response.json())
//         .then(json => (BigNumber.from(Math.round(json.standard.maxFee * (10 ** 9)))))
// }

async function removeAndBurn(WALLET_ADDRESS, WALLET_SECRET){
    const wallet = new ethers.Wallet(WALLET_SECRET)
    const connectedWallet = wallet.connect(web3Provider)

    const NftPosManagerABI = require('../abi/V3PosManagerABI.json')
    const NftPosManagerContract = new ethers.Contract(V3_NFT_POS_MANAGER_ADDRESS, NftPosManagerABI, web3Provider)
    const tokenId = await NftPosManagerContract.tokenOfOwnerByIndex(WALLET_ADDRESS, 0)
    const positiondata = await NftPosManagerContract.positions(tokenId)
    // console.log(positiondata)

    const [immutables, state] = await Promise.all([getPoolImmutables(), getPoolState()])

    const pool = new Pool(
        Token0,
        Token1,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick,
    )

    const position = new Position({
        pool: pool,
        tickLower: positiondata.tickLower,
        tickUpper: positiondata.tickUpper,
        liquidity: JSBI.BigInt(positiondata.liquidity),
    })
    // console.log(position)

    const { calldata, value } = NonfungiblePositionManager.removeCallParameters(position, {
        tokenId: tokenId,
        liquidityPercentage: new Percent(1),
        slippageTolerance: new Percent(10, 100),
        deadline: Math.round(Date.now() / 1000) + 300,
        burnToken: true,
        collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(Token0, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(Token1, 0),
            recipient: WALLET_ADDRESS,
        },
    })
    // console.log({calldata, value})


    await NftPosManagerContract.connect(connectedWallet).approve(
        V3_NFT_POS_MANAGER_ADDRESS,
        tokenId,
        {
            gasPrice:web3Provider.getGasPrice(),
            gasLimit: BigNumber.from('100000')
        }
    )

    const transaction = {
        data: calldata,
        to: V3_NFT_POS_MANAGER_ADDRESS,
        value: BigNumber.from(value),
        from: WALLET_ADDRESS,
        gasPrice: await web3Provider.getGasPrice(),
        gasLimit: BigNumber.from('500000')
    };
    // console.log(transaction)
    return await connectedWallet.sendTransaction(transaction).then(function(transaction) {
        return transaction.wait();
    })

}

async function getBalance(tokenContract, WALLET_ADDRESS){
    return await tokenContract.balanceOf(WALLET_ADDRESS)
}

async function approveMax(tokenContract, to, WALLET_SECRET) {
    const wallet = new ethers.Wallet(WALLET_SECRET)
    const connectedWallet = wallet.connect(web3Provider)

    return await tokenContract.connect(connectedWallet).approve(
        to,
        ethers.constants.MaxUint256,
        {
            gasPrice: await web3Provider.getGasPrice(),
            gasLimit: BigNumber.from('10000000')
        }
    ).then(function(transaction) {
        return transaction.wait();
    })
}

async function swap(inputToken, outputToken, amount, WALLET_ADDRESS, WALLET_SECRET) {
    amount = Number(amount).toFixed(inputToken.decimals)
    const inputTokenBalance = CurrencyAmount.fromRawAmount(inputToken, JSBI.BigInt(ethers.utils.parseUnits(String(amount), inputToken.decimals)))
    const route = await router.route(
        inputTokenBalance,
        outputToken,
        TradeType.EXACT_INPUT,
        {
            recipient: WALLET_ADDRESS,
            slippageTolerance: new Percent(5, 100),
            deadline: Math.floor(Date.now()/1000 + 240)
        }
    )

    const wallet = new ethers.Wallet(WALLET_SECRET)
    const connectedWallet = wallet.connect(web3Provider)

    const transaction = {
        data: route.methodParameters.calldata,
        to: V3_SWAP_ROUTER_ADDRESS,
        value: BigNumber.from(route.methodParameters.value),
        from: WALLET_ADDRESS,
        gasPrice: BigNumber.from(route.gasPriceWei),
        gasLimit: ethers.utils.hexlify(1000000)
    }
    return await connectedWallet.sendTransaction(transaction).then(function(transaction) {
        return transaction.wait();
    })
}

export {
    V3_SWAP_ROUTER_ADDRESS,
    Token0,
    Token1,
    // tokenForAAVE,
    token0Contract,
    token1Contract,
    // tokenForAAVEContract,
    web3Provider,
    chainId,
    ethers,
    getPoolImmutables,
    getPoolState,
    swapAndAdd,
    swap,
    // getGasPrice,
    removeAndBurn,
    getBalance,
    approveMax
}

