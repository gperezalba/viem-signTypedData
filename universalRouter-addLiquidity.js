import { createPublicClient, http, createWalletClient, getContract, parseSignature, verifyTypedData, parseUnits, encodeAbiParameters, getAbiItem, parseEther, zeroHash, maxUint256 } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { UNIVERSAL_ROUTER_ABI } from "./UNIVERSAL_ROUTER_ABI.js"
import { GT3_ABI } from "./GT3_ABI.js"

const MY_SEPOLIA_RPC = process.env.RPC
const PRIVATE_KEY = process.env.PRIVATE_KEY
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS
const GT3_ADDRESS = process.env.GT3_ADDRESS
const USDT_ADDRESS = process.env.USDT_ADDRESS

const client = createPublicClient({
    chain: sepolia,
    transport: http(MY_SEPOLIA_RPC),
})

const walletClient = createWalletClient({
    account: privateKeyToAccount(PRIVATE_KEY),
    transport: http(MY_SEPOLIA_RPC)
})

const gt3Contract = getContract({
    address: GT3_ADDRESS,
    abi: GT3_ABI,
    client: client,
})

const routerContract = getContract({
    address: ROUTER_ADDRESS,
    abi: UNIVERSAL_ROUTER_ABI,
    client: client,
})

const domain = {
    name: "GT3 Token",
    version: "1",
    chainId: 11155111,
    verifyingContract: GT3_ADDRESS,
}

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
    const userPermitNonce = await gt3Contract.read.nonces([account.address])

    const message = {
        owner: account.address,
        spender: ROUTER_ADDRESS,
        value: parseEther("1"),
        nonce: userPermitNonce,
        deadline: 115792089237316195423570985008687907853269984665640564039457584007913129639935n //usar parseInt(Date.now() / 1000) + 600 p.ej
    }

    //hago esto para ahorrar tiempo, hacedlo como lo tengáis
    const quote = await routerContract.read.quoteAddLiquidity([GT3_ADDRESS, USDT_ADDRESS, message.value, maxUint256])

    const signature = await walletClient.signTypedData({
        account,
        domain,
        types,
        primaryType: "Permit",
        message
    })
    const parsedSignature = parseSignature(signature)

    await walletClient.writeContract({
        address: ROUTER_ADDRESS,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "addLiquidityWithPermit",
        args: [
            [GT3_ADDRESS, USDT_ADDRESS],
            [message.value, quote[1]],
            [0n, 0n], //esto no será 0, pero ya lo tendréis calculado, eso sigue igual
            account.address,
            message.deadline,
            [
                { v: parsedSignature.v, r: parsedSignature.r, s: parsedSignature.s },
                { v: BigInt(0), r: zeroHash, s: zeroHash }
            ]
        ],
        account
    })
}

main()