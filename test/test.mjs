import { ethers, web3Provider, V3_SWAP_ROUTER_ADDRESS, Token0, Token1, token0Contract, token1Contract, getPoolState, getBalance, getPoolImmutables, swapAndAdd, removeAndBurn, approveMax, swap } from './uniswapContractCommunication.mjs';
import EthersAdapter from '@safe-global/safe-ethers-lib'
import SafeServiceClient from'@safe-global/safe-service-client'
import Safe, { SafeFactory } from '@safe-global/safe-core-sdk';
import * as dotenv from 'dotenv'

function priceToTick(price) {
    val_to_log = price * 10 ** (Token1.decimals - Token0.decimals)
    tick_id = Math.log(val_to_log) / Math.log(1.0001)
    return Math.round(tick_id, 0)
}

async function wrappEth(balance, WALLET_SECRET){
    const wallet = new ethers.Wallet(WALLET_SECRET)
    const connectedWallet = wallet.connect(web3Provider)

    const transaction = {
        from: WALLET_ADDRESS,
        to: token0Contract.address,
        gasLimit: 100000,
        gasPrice: await web3Provider.getGasPrice(),
        value: ethers.utils.parseUnits(balance.toString(), Token0.decimals)
    }

    return await connectedWallet.sendTransaction(transaction).then(function(transaction) {
        return transaction.wait();
    })
}

async function test(){
    dotenv.config()
    const WALLET_ADDRESS = process.env.WALLET_ADDRESS
    const WALLET_SECRET = process.env.WALLET_SECRET
    const ALCHEMY_API = process.env.ALCHEMY_API

    const safeOwner = new ethers.Wallet(WALLET_SECRET)
    const ethAdapter = new EthersAdapter.constructor({
      ethers,
      safeOwner
    })


    const txServiceUrl = 'https://safe-transaction-mainnet.safe.global'
    const safeService = new SafeServiceClient.constructor({ txServiceUrl, ethAdapter })

    const safeFactory = await SafeFactory.create({ ethAdapter })



    // const safeSdk = await Safe.create({ ethAdapter, safeAddress })

    await approveMax(token0Contract, V3_SWAP_ROUTER_ADDRESS, WALLET_SECRET)
    await approveMax(token1Contract, V3_SWAP_ROUTER_ADDRESS, WALLET_SECRET)
    let poolState = await getPoolState()
    let poolImmutables = await getPoolImmutables()
    let currPrice = poolState.sqrtPriceX96 * poolState.sqrtPriceX96 * (10 ** Token0.decimals) / (10 ** Token1.decimals) / 2 ** 192
    let lowerTick = priceToTick(currPrice * ((100 - 5) / 100))
    let upperTick = priceToTick(currPrice * ((100 + 5) / 100))
    let width = Math.round(Math.abs((lowerTick - upperTick) / 2, 0) / poolImmutables.tickSpacing)

    await wrappEth(10, WALLET_SECRET)
    token0Balance = await getBalance(token0Contract, WALLET_ADDRESS)
    token1Balance = await getBalance(token1Contract, WALLET_ADDRESS)
    console.log(token0Balance.toString() / 10 ** Token0.decimals, token1Balance.toString() / 10 ** Token0.decimals)
    
    console.log(await swapAndAdd(width, (token0Balance / 10 ** Token0.decimals).toString(), (token1Balance / 10 ** Token1.decimals).toString(), WALLET_ADDRESS, WALLET_SECRET))
    // console.log(await swap(Token0, Token1, (token0Balance.toString() / 10 ** Token0.decimals.toString()), WALLET_ADDRESS, WALLET_SECRET))

    token0Balance = (await getBalance(token0Contract, WALLET_ADDRESS)).toString()
    token1Balance = (await getBalance(token1Contract, WALLET_ADDRESS)).toString()

    console.log(token0Balance.toString() / 10 ** Token0.decimals, token1Balance.toString() / 10 ** Token1.decimals)
}

test()
