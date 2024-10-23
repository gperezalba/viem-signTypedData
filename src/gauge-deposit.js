import { createPublicClient, http, createWalletClient, getContract, parseSignature, verifyTypedData, parseUnits, encodeAbiParameters, getAbiItem, parseEther, zeroHash, maxUint256 } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { FACTORY_ABI } from "../abis/FACTORY_ABI.js"
import { VOTER_ABI } from "../abis/VOTER_ABI.js"
import { GAUGE_ABI } from "../abis/GAUGE_ABI.js"
import { PAIR_ABI } from "../abis/PAIR_ABI.js"

const MY_SEPOLIA_RPC = process.env.RPC
const PRIVATE_KEY = process.env.PRIVATE_KEY
const VOTER_ADDRESS = process.env.VOTER_ADDRESS
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS
const GT3_ADDRESS = process.env.GT3_ADDRESS
const WBTC_ADDRESS = process.env.WBTC_ADDRESS

const client = createPublicClient({
    chain: sepolia,
    transport: http(MY_SEPOLIA_RPC),
})

const walletClient = createWalletClient({
    account: privateKeyToAccount(PRIVATE_KEY),
    transport: http(MY_SEPOLIA_RPC)
})

const voterContract = getContract({
    address: VOTER_ADDRESS,
    abi: VOTER_ABI,
    client: client,
})

const factoryContract = getContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    client: client,
})

const types = {
    Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
    ]
}

async function main() {
    const account = privateKeyToAccount(PRIVATE_KEY)

    const pairAddress = await factoryContract.read.getPair([WBTC_ADDRESS, GT3_ADDRESS])
    const pairContract = getContract({
        address: pairAddress,
        abi: PAIR_ABI,
        client: client,
    })

    const userPermitNonce = await pairContract.read.nonces([account.address])
    const pairName = await pairContract.read.name()

    const domain = {
        name: pairName,
        version: "1",
        chainId: 11155111,
        verifyingContract: pairAddress,
    }

    const gaugeAddress = await voterContract.read.gauges([pairAddress])
    const pairBalance = await pairContract.read.balanceOf([account.address])
    const message = {
        owner: account.address,
        spender: gaugeAddress,
        value: pairBalance,
        nonce: userPermitNonce,
        deadline: 115792089237316195423570985008687907853269984665640564039457584007913129639935n //usar parseInt(Date.now() / 1000) + 600 p.ej
    }

    const signature = await walletClient.signTypedData({
        account,
        domain,
        types,
        primaryType: "Permit",
        message
    })
    const parsedSignature = parseSignature(signature)

    await walletClient.writeContract({
        address: gaugeAddress,
        abi: GAUGE_ABI,
        functionName: "deposit",
        args: [
            message.value,
            message.deadline,
            parsedSignature.v,
            parsedSignature.r,
            parsedSignature.s
        ],
        account
    })
}

main()