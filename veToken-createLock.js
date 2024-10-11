import { createPublicClient, http, createWalletClient, getContract, parseSignature, verifyTypedData, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { VE_ABI } from "./VE_ABI.js"
import { GT3_ABI } from "./GT3_ABI.js"

const MY_SEPOLIA_RPC = process.env.RPC
const PRIVATE_KEY = process.env.PRIVATE_KEY
const VE_ADDRESS = process.env.XGT3_ADDRESS
const GT3_ADDRESS = process.env.GT3_ADDRESS

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
        spender: VE_ADDRESS,
        value: 100n,
        nonce: userPermitNonce,
        deadline: 115792089237316195423570985008687907853269984665640564039457584007913129639935n //parseUnits(parseInt(Date.now() + 600).toString(), 0)
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
        address: VE_ADDRESS,
        abi: VE_ABI,
        functionName: "createLock",
        args: [message.value, 8640000n, message.deadline, parsedSignature.v, parsedSignature.r, parsedSignature.s],
        account
    })
}

main()