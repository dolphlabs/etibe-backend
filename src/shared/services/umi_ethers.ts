// //@ts-nocheck
// import { ethers, Contract, Wallet, JsonRpcProvider } from "ethers";
// import EtibeChannelFactory from "../abis/EtibeChannelFactory.json";
// import { envConfigs } from "@/shared/configs/env.configs";
// import EtibeChannel from "../abis/EtibeChannel.json";
// import { BadRequestException } from "@dolphjs/dolph/common";

// // Custom Network class to disable ENS
// class NoEnsNetwork extends ethers.Network {
//   constructor(name: string, chainId: number) {
//     super(name, chainId);
//   }

//   getPlugin<T extends ethers.Plugin>(name: string): T | null {
//     if (name === "org.ethers.plugins.network.Ens") {
//       console.log(`[NoEnsNetwork] ENS plugin disabled for ${name}`);
//       return null;
//     }
//     return super.getPlugin(name);
//   }
// }

// // Custom Provider class to handle UMI network specifics
// export class UmiProvider extends JsonRpcProvider {
//   private maxRetries: number = 3;
//   private retryDelay: number = 1000;
//   private nonce: number = 0; // Local nonce tracking
//   private chainId: number = 42069; // Hardcoded UMI devnet chain ID

//   constructor(url: string, network: ethers.Networkish) {
//     super(url, network, { batchMaxCount: 1 }); // Disable request batching

//     // Disable ENS resolution for UMI network
//     this.resolveName = async (name: string) => {
//       console.log(`[UmiProvider] ENS resolution disabled for ${name}`);
//       return name;
//     };

//     this.lookupAddress = async (address: string) => {
//       console.log(`[UmiProvider] Address lookup disabled for ${address}`);
//       return address;
//     };
//   }

//   // Helper method to validate JSON-RPC response for UMI network
//   private validateResponse(response: any, method: string): boolean {
//     if (!response) {
//       console.error(
//         `[UmiProvider] Response is null or undefined for ${method}`
//       );
//       return false;
//     }

//     // Handle UMI's non-standard response format
//     if (response.error) {
//       console.error(`[UmiProvider] RPC Error for ${method}:`, response.error);
//       return false;
//     }

//     // Allow responses without result field for certain methods
//     if (response.result !== undefined) {
//       return true;
//     }

//     // Handle raw responses for specific methods
//     if (
//       method === "eth_gasPrice" &&
//       typeof response === "string" &&
//       response.startsWith("0x")
//     ) {
//       console.log(
//         `[UmiProvider] Accepting raw gas price response: ${response}`
//       );
//       return true;
//     }

//     if (
//       method === "eth_blockNumber" &&
//       typeof response === "string" &&
//       response.startsWith("0x")
//     ) {
//       console.log(
//         `[UmiProvider] Accepting raw block number response: ${response}`
//       );
//       return true;
//     }

//     if (
//       method === "eth_sendRawTransaction" &&
//       typeof response === "string" &&
//       response.startsWith("0x") &&
//       response.length === 66
//     ) {
//       console.log(
//         `[UmiProvider] Accepting raw transaction hash response: ${response}`
//       );
//       return true;
//     }

//     // Handle block data for eth_getBlockByNumber
//     if (
//       method === "eth_getBlockByNumber" &&
//       response.hash &&
//       response.number &&
//       response.transactions &&
//       response.timestamp
//     ) {
//       console.log(
//         `[UmiProvider] Accepting direct block data response for ${method}`
//       );
//       return true;
//     }

//     console.error(
//       `[UmiProvider] Invalid response format for ${method}:`,
//       response
//     );
//     return false;
//   }

//   // Helper method to handle retry logic
//   private async retryRequest<T>(
//     operation: () => Promise<T>,
//     method: string,
//     retries: number = this.maxRetries
//   ): Promise<T> {
//     try {
//       return await operation();
//     } catch (error) {
//       if (retries > 0) {
//         console.warn(
//           `[UmiProvider] Retrying ${method}, ${retries} attempts left`
//         );
//         await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
//         return this.retryRequest(operation, method, retries - 1);
//       }
//       throw error;
//     }
//   }

//   // Override send method to handle UMI network specifics
//   async send(method: string, params: any[]): Promise<any> {
//     console.log(`[UmiProvider] Sending ${method} with params:`, params);

//     // Handle specific methods
//     if (method === "eth_chainId") {
//       console.log(
//         `[UmiProvider] Returning hardcoded chain ID: ${this.chainId}`
//       );
//       return `0x${this.chainId.toString(16)}`;
//     }

//     if (method === "eth_getTransactionCount") {
//       console.log(`[UmiProvider] Using local nonce: ${this.nonce}`);
//       return `0x${this.nonce.toString(16)}`;
//     }

//     if (
//       method === "eth_getBlockByNumber" ||
//       method === "eth_blockNumber" ||
//       method === "eth_gasPrice"
//     ) {
//       try {
//         const response = await super.send(method, params);
//         if (this.validateResponse(response, method)) {
//           // Convert raw responses to standard format
//           if (typeof response === "string" && response.startsWith("0x")) {
//             return { jsonrpc: "2.0", id: params[1]?.id || 1, result: response };
//           }
//           if (method === "eth_getBlockByNumber" && !response.result) {
//             return { jsonrpc: "2.0", id: params[1]?.id || 1, result: response };
//           }
//           return response;
//         }
//         throw new Error(`Invalid response format for ${method}`);
//       } catch (error: any) {
//         console.error(`[UmiProvider] Error in ${method}:`, error);
//         throw error;
//       }
//     }

//     if (method === "eth_sendRawTransaction") {
//       try {
//         const response = await super.send(method, params);
//         if (this.validateResponse(response, method)) {
//           // Treat raw hash as valid transaction hash
//           if (
//             typeof response === "string" &&
//             response.startsWith("0x") &&
//             response.length === 66
//           ) {
//             const txHash = response;
//             console.log(`[UmiProvider] Transaction hash received: ${txHash}`);
//             // Confirm transaction status
//             const receipt = await this.waitForTransaction(txHash, 1, 30000);
//             return {
//               jsonrpc: "2.0",
//               id: params[1]?.id || 1,
//               result: txHash,
//               receipt,
//             };
//           }
//           return response;
//         }
//         throw new Error(`Invalid response format for ${method}`);
//       } catch (error: any) {
//         console.error(`[UmiProvider] Error in ${method}:`, error);
//         throw error;
//       }
//     }

//     return this.retryRequest(async () => {
//       try {
//         const response = await super.send(method, params);

//         if (!this.validateResponse(response, method)) {
//           throw new Error(`Invalid response format for ${method}`);
//         }

//         // Increment nonce for successful transaction-related calls
//         if (method === "eth_sendRawTransaction") {
//           this.nonce++;
//         }

//         return response;
//       } catch (error: any) {
//         console.error(`[UmiProvider] Error in ${method}:`, error);

//         if (error.message?.includes("method field not found")) {
//           throw new Error(`UMI network does not support method: ${method}`);
//         }

//         if (error.message?.includes("missing response for request")) {
//           throw new Error(
//             `UMI network returned invalid response for ${method}`
//           );
//         }

//         // Handle CALL_EXCEPTION for eth_estimateGas
//         if (method === "eth_estimateGas" && error.code === "CALL_EXCEPTION") {
//           console.warn(`[UmiProvider] Gas estimation failed, using default`);
//           return "0x7A120"; // 500,000 gas default
//         }

//         // Fallbacks for gas-related methods
//         if (method === "eth_gasPrice") {
//           console.warn(
//             `[UmiProvider] Gas price estimation failed, using default`
//           );
//           return "0x3B9ACA00"; // 1 gwei default
//         }

//         if (method === "eth_estimateGas") {
//           console.warn(`[UmiProvider] Gas estimation failed, using default`);
//           return "0x7A120"; // 500,000 gas default
//         }

//         if (method === "eth_maxPriorityFeePerGas") {
//           console.warn(
//             `[UmiProvider] eth_maxPriorityFeePerGas not supported, using default`
//           );
//           return "0x3B9ACA00"; // 1 gwei default
//         }

//         throw error;
//       }
//     }, method);
//   }

//   // Override getNetwork to return hardcoded chain ID
//   async getNetwork(): Promise<ethers.Network> {
//     console.log("[UmiProvider] Returning hardcoded network");
//     return new NoEnsNetwork("umi-devnet", this.chainId);
//   }

//   // Override getTransactionCount to use local nonce
//   async getTransactionCount(
//     address: string,
//     blockTag?: ethers.BlockTag
//   ): Promise<number> {
//     console.log(
//       `[UmiProvider] Returning local nonce for ${address}: ${this.nonce}`
//     );
//     return this.nonce;
//   }

//   // Method to debug RPC connectivity
//   async debugRpc(): Promise<any> {
//     const methodsToTest = [
//       "eth_chainId",
//       "eth_getTransactionCount",
//       "eth_blockNumber",
//       "eth_getBalance",
//       "eth_getBlockByNumber",
//       "eth_estimateGas",
//       "eth_gasPrice",
//       "net_version",
//     ];
//     const results: { [key: string]: any } = {};

//     for (const method of methodsToTest) {
//       try {
//         let params: any[] = [];
//         if (
//           method === "eth_getTransactionCount" ||
//           method === "eth_getBalance"
//         ) {
//           params = [
//             this.wallet?.address ||
//               "0x145a284f75c427eB91554655d5914f32D8837663",
//             "latest",
//           ];
//         } else if (method === "eth_getBlockByNumber") {
//           params = ["latest", false];
//         } else if (method === "eth_estimateGas") {
//           params = [
//             {
//               from:
//                 this.wallet?.address ||
//                 "0x145a284f75c427eB91554655d5914f32D8837663",
//               to: envConfigs.contractAddress,
//               data: "0x", // Simple call to test
//             },
//           ];
//         }
//         const result = await super.send(method, params);
//         results[method] = { status: "success", result };
//       } catch (error: any) {
//         results[method] = { status: "error", error: error.message };
//       }
//     }

//     console.log("[UmiProvider] RPC Debug Results:", results);
//     return results;
//   }

//   // Override getFeeData to skip EIP-1559
//   async getFeeData(): Promise<ethers.FeeData> {
//     try {
//       const gasPrice = await this.send("eth_gasPrice", []);
//       return {
//         gasPrice: ethers.BigNumber.from(gasPrice.result || gasPrice),
//         maxFeePerGas: null,
//         maxPriorityFeePerGas: null,
//       };
//     } catch (error) {
//       console.warn("[UmiProvider] Failed to get fee data, using defaults");
//       return {
//         gasPrice: ethers.parseUnits("1", "gwei"),
//         maxFeePerGas: null,
//         maxPriorityFeePerGas: null,
//       };
//     }
//   }

//   // Initialize wallet for nonce tracking
//   private wallet: Wallet | null = null;
//   setWallet(wallet: Wallet) {
//     this.wallet = wallet;
//   }

//   async _send(payload: any): Promise<any> {
//     const resp = await fetch(this._url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         ...this._headers,
//       },
//       body: JSON.stringify(payload),
//     });
//     const text = await resp.text();
//     try {
//       const json = JSON.parse(text);
//       if (json.error) {
//         throw this.getRpcError(json);
//       }
//       return json.result;
//     } catch (error) {
//       // For UMI, some methods return raw strings
//       const rawMethods = [
//         "eth_blockNumber",
//         "eth_gasPrice",
//         "eth_sendRawTransaction",
//       ];
//       if (rawMethods.includes(payload.method)) {
//         return text;
//       } else {
//         throw new Error(
//           `could not parse JSON response for ${payload.method}: ${text}`
//         );
//       }
//     }
//   }
// }

// export class EtherService {
//   privateKey: string;
//   wallet: ethers.Wallet;
//   factoryAddress: string;
//   rpcUrl: string;
//   provider: UmiProvider;
//   chainId: number;
//   private isInitialized: boolean = false;

//   constructor(_privateKey: string) {
//     if (!ethers.isAddress(envConfigs.contractAddress)) {
//       throw new BadRequestException("Contract Address is invalid");
//     }

//     this.factoryAddress = envConfigs.contractAddress;
//     this.rpcUrl = envConfigs.rpcUrl;
//     this.privateKey = _privateKey;
//     this.chainId = 42069; // Hardcoded UMI devnet chain ID

//     const umiNetwork = new NoEnsNetwork("umi-devnet", this.chainId);
//     this.provider = new UmiProvider(this.rpcUrl, umiNetwork);
//     this.wallet = new Wallet(this.privateKey, this.provider);
//     this.provider.setWallet(this.wallet); // Set wallet for nonce tracking

//     console.log(`[EtherService] Initialized for UMI network`);
//     console.log(`[EtherService] RPC URL: ${this.rpcUrl}`);
//     console.log(`[EtherService] Chain ID: ${this.chainId}`);
//     console.log(`[EtherService] Wallet Address: ${this.wallet.address}`);
//   }

//   async initialize(): Promise<boolean> {
//     try {
//       console.log("[EtherService] Initializing connection...");

//       // Test basic connectivity
//       const isConnected = await this.verifyConnection();
//       if (!isConnected) {
//         throw new Error("Failed to connect to UMI network");
//       }

//       // Debug RPC methods
//       await this.provider.debugRpc();

//       this.isInitialized = true;
//       console.log("[EtherService] Successfully initialized");
//       return true;
//     } catch (error) {
//       console.error("[EtherService] Initialization failed:", error);
//       this.isInitialized = false;
//       throw error;
//     }
//   }

//   async verifyConnection(): Promise<boolean> {
//     try {
//       console.log("[EtherService] Verifying network connection...");

//       // Test block number
//       const blockNumber = await this.provider.getBlockNumber();
//       console.log(`[EtherService] Latest block number: ${blockNumber}`);

//       // Test balance query
//       const balance = await this.provider.getBalance(this.wallet.address);
//       console.log(
//         `[EtherService] Wallet balance: ${ethers.formatEther(balance)} ETH`
//       );

//       return true;
//     } catch (error) {
//       console.error(`[EtherService] Network connection failed:`, error);
//       return false;
//     }
//   }

//   async getNetworkInfo() {
//     if (!this.isInitialized) {
//       await this.initialize();
//     }

//     try {
//       const network = await this.provider.getNetwork();
//       const blockNumber = await this.provider.getBlockNumber();
//       const gasPrice = await this.provider.getFeeData();
//       const balance = await this.provider.getBalance(this.wallet.address);

//       return {
//         network: network.name,
//         chainId: network.chainId.toString(),
//         blockNumber,
//         balance: ethers.formatEther(balance),
//         gasPrice: gasPrice.gasPrice?.toString() || "0",
//         maxFeePerGas: gasPrice.maxFeePerGas?.toString() || "0",
//         maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString() || "0",
//         walletAddress: this.wallet.address,
//       };
//     } catch (error) {
//       console.error(`[EtherService] Failed to get network info:`, error);
//       throw error;
//     }
//   }

//   factoryContract(): EtibeChannelFactoryContract {
//     return new Contract(
//       this.factoryAddress,
//       EtibeChannelFactory.abi as any,
//       this.wallet
//     ) as unknown as EtibeChannelFactoryContract;
//   }

//   channelContract(channelAddress: string): EtibeChannelContract {
//     if (!ethers.isAddress(channelAddress)) {
//       throw new BadRequestException("Invalid channel address");
//     }

//     return new Contract(
//       channelAddress,
//       EtibeChannel.abi as any,
//       this.wallet
//     ) as unknown as EtibeChannelContract;
//   }

//   async estimateGas(contractMethod: any, ...args: any[]): Promise<bigint> {
//     try {
//       console.log(`[EtherService] Estimating gas for method with args:`, args);
//       const gasEstimate = await contractMethod.estimateGas(...args);
//       console.log(`[EtherService] Gas estimate: ${gasEstimate}`);
//       return (gasEstimate * 150n) / 100n; // 50% buffer
//     } catch (error: any) {
//       console.error(`[EtherService] Gas estimation failed:`, error);
//       if (error.code === "CALL_EXCEPTION") {
//         console.error(
//           `[EtherService] Contract call reverted: ${
//             error.info?.error?.message || "Unknown revert reason"
//           }`
//         );
//       }
//       return 800000n; // Default gas limit
//     }
//   }

//   async getTransactionOptions(
//     overrides?: ethers.Overrides
//   ): Promise<ethers.Overrides> {
//     try {
//       const feeData = await this.provider.getFeeData();

//       const options: ethers.Overrides = {
//         gasLimit: 800000n,
//         nonce: await this.provider.getTransactionCount(this.wallet.address),
//         ...overrides,
//       };

//       if (feeData.gasPrice) {
//         options.gasPrice = feeData.gasPrice;
//       } else {
//         options.gasPrice = ethers.parseUnits("2", "gwei");
//       }

//       console.log(`[EtherService] Transaction options:`, options);
//       return options;
//     } catch (error) {
//       console.error(`[EtherService] Failed to get transaction options:`, error);
//       return {
//         gasLimit: 800000n,
//         gasPrice: ethers.parseUnits("2", "gwei"),
//         nonce: await this.provider.getTransactionCount(this.wallet.address),
//         ...overrides,
//       };
//     }
//   }

//   async executeTransaction(
//     contractMethod: any,
//     methodName: string,
//     ...args: any[]
//   ): Promise<ethers.ContractTransactionResponse> {
//     if (!this.isInitialized) {
//       await this.initialize();
//     }

//     try {
//       console.log(`[EtherService] Executing ${methodName} with args:`, args);
//       const txOptions = await this.getTransactionOptions();
//       const tx = await contractMethod(...args, txOptions);
//       console.log(`[EtherService] Transaction sent: ${tx.hash}`);
//       const receipt = await tx.wait();
//       console.log(`[EtherService] Transaction confirmed:`, receipt);
//       return tx;
//     } catch (error) {
//       console.error(`[EtherService] Transaction ${methodName} failed:`, error);
//       throw error;
//     }
//   }
// }

// // Contract interfaces remain unchanged
// export interface EtibeChannelFactoryContract extends Contract {
//   createChannel(
//     _channelName: string,
//     _channelImage: string,
//     _contributionAmount: bigint,
//     _startDate: bigint,
//     _gracePeriodInDays: number,
//     _isPublic: boolean,
//     _invitedMembers: string[],
//     _payoutOrder: bigint[],
//     overrides?: ethers.Overrides
//   ): Promise<ethers.ContractTransactionResponse>;
//   getChannelCount(): Promise<bigint>;
//   getChannelAddress(index: bigint): Promise<string>;
//   deployedChannels(index: bigint): Promise<string>;
// }

// export interface EtibeChannelContract extends Contract {
//   admin(): Promise<string>;
//   channelName(): Promise<string>;
//   contributionAmount(): Promise<bigint>;
//   channelSize(): Promise<bigint>;
//   creationDate(): Promise<bigint>;
//   startDate(): Promise<bigint>;
//   gracePeriod(): Promise<bigint>;
//   channelImage(): Promise<string>;
//   isPublic(): Promise<boolean>;
//   currentCycleMonth(): Promise<bigint>;
//   isLocked(): Promise<boolean>;
//   isComplete(): Promise<boolean>;
//   getChannelDetails(): Promise<
//     [
//       string,
//       bigint,
//       bigint,
//       boolean,
//       bigint,
//       bigint,
//       boolean,
//       bigint,
//       bigint,
//       bigint,
//       string,
//       boolean
//     ]
//   >;
//   getMemberStatus(
//     memberAddr: string
//   ): Promise<[bigint, bigint, bigint, bigint]>;
//   getMemberAddressesLength(): Promise<bigint>;
//   acceptInvite(
//     overrides?: ethers.Overrides
//   ): Promise<ethers.ContractTransactionResponse>;
//   lockChannel(
//     overrides?: ethers.Overrides
//   ): Promise<ethers.ContractTransactionResponse>;
//   makeContribution(
//     overrides?: ethers.Overrides & { value?: bigint }
//   ): Promise<ethers.ContractTransactionResponse>;
//   processMonthlyPayout(
//     overrides?: ethers.Overrides
//   ): Promise<ethers.ContractTransactionResponse>;
//   enforceGracePeriodAndRemove(
//     memberToRemove: string,
//     overrides?: ethers.Overrides
//   ): Promise<ethers.ContractTransactionResponse>;
// }
