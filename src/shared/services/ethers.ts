//@ts-nocheck
import { ethers, Contract, Wallet, JsonRpcProvider } from "ethers";
import EtibeChannelFactoryAbi from "../abis/EtibeChannelFactory.json";
import EtibeChannelAbi from "../abis/EtibeChannel.json";
import { envConfigs } from "../configs/env.configs";
import { BadRequestException } from "@dolphjs/dolph/common";

class NoEnsNetwork extends ethers.Network {
  constructor(name: string, chainId: number) {
    super(name, chainId);
  }

  // This override is confirmed to work; it returns null for the ENS plugin.
  getPlugin<T extends ethers.Plugin>(name: string): T | null {
    if (name === "org.ethers.plugins.network.Ens") {
      console.log(
        `[NoEnsNetwork] getPlugin('${name}') called, returning null.`
      );
      return null;
    }
    return super.getPlugin(name);
  }
}

export class EtherService {
  privateKey: string;
  wallet: ethers.Wallet;
  factoryAddress: string;
  rpcUrl: string;
  provider: ethers.JsonRpcProvider;

  constructor(_privateKey: string) {
    if (!ethers.isAddress(envConfigs.contractAddress)) {
      throw new BadRequestException("Contract Address is invalid");
    }

    this.factoryAddress = envConfigs.contractAddress;
    this.rpcUrl = envConfigs.rpcUrl;
    this.privateKey = _privateKey;

    // sepolia -base
    // const targetChainId = 84532;
    const targetChainId = 1337;

    const network = new NoEnsNetwork(
      `my-no-ens-network-${targetChainId}`,
      targetChainId
    );

    this.provider = new JsonRpcProvider(this.rpcUrl, network);

    // --- NEW ADDITION FOR MORE AGGRESSIVE ENS DISABLING ---
    // In ethers v6, the Provider, when initialised with a Network,
    // should reflect that Network's plugin configuration.
    // However, if some internal Ethers operation *within the provider itself*
    // or related to the wallet initialization tries to resolve something
    // as an ENS name, it might still trigger this.

    // Explicitly set the resolveName method on the provider to null
    // or a no-op function, *if* the error is happening during provider setup.
    (this.provider as any).resolveName = (name: string) => {
      console.warn(
        `[EthersService] Provider.resolveName called for '${name}', returning null (ENS disabled).`
      );
      return null;
    };
    (this.provider as any).lookupAddress = (address: string) => {
      console.warn(
        `[EthersService] Provider.lookupAddress called for '${address}', returning null (ENS disabled).`
      );
      return null;
    };
    // --- END NEW ADDITION ---

    this.wallet = new Wallet(this.privateKey, this.provider);
  }

  factoryContract(): EtibeChannelFactoryContract {
    return new Contract(
      this.factoryAddress,
      EtibeChannelFactoryAbi.abi as any,
      this.wallet
    ) as unknown as EtibeChannelFactoryContract;
  }

  channelContract(channelAddress: string): EtibeChannelContract {
    return new Contract(
      channelAddress,
      EtibeChannelAbi.abi as any,
      this.wallet
    ) as unknown as EtibeChannelContract;
  }
}

export interface EtibeChannelFactoryContract extends Contract {
  createChannel(
    _channelName: string,
    _channelImage: string,
    _contributionAmount: bigint,
    _startDate: bigint,
    _gracePeriodInDays: number,
    _isPublic: boolean,
    _invitedMembers: string[],
    _payoutOrder: bigint[],
    overrides?: ethers.Overrides
  ): Promise<ethers.ContractTransactionResponse>;
  getChannelCount(): Promise<bigint>;
  getChannelAddress(index: bigint): Promise<string>;
  deployedChannels(index: bigint): Promise<string>;
}

// Define types for EtibeChannel contract
export interface EtibeChannelContract extends Contract {
  // Read functions (view/pure)
  admin(): Promise<string>;
  channelName(): Promise<string>;
  contributionAmount(): Promise<bigint>;
  channelSize(): Promise<bigint>;
  creationDate(): Promise<bigint>;
  startDate(): Promise<bigint>;
  gracePeriod(): Promise<bigint>;
  channelImage(): Promise<string>;
  isPublic(): Promise<boolean>;
  currentCycleMonth(): Promise<bigint>;
  isLocked(): Promise<boolean>;
  isComplete(): Promise<boolean>;
  getChannelDetails(): Promise<
    [
      string,
      bigint,
      bigint,
      boolean,
      bigint,
      bigint,
      boolean,
      bigint,
      bigint,
      bigint,
      string,
      boolean
    ]
  >;
  getMemberStatus(
    memberAddr: string
  ): Promise<[bigint, bigint, bigint, bigint]>;
  getMemberAddressesLength(): Promise<bigint>;

  // Write functions (payable/nonpayable)
  acceptInvite(
    overrides?: ethers.Overrides
  ): Promise<ethers.ContractTransactionResponse>;
  lockChannel(
    overrides?: ethers.Overrides
  ): Promise<ethers.ContractTransactionResponse>;
  makeContribution(
    overrides?: ethers.Overrides & { value?: bigint }
  ): Promise<ethers.ContractTransactionResponse>;
  processMonthlyPayout(
    overrides?: ethers.Overrides
  ): Promise<ethers.ContractTransactionResponse>;
  enforceGracePeriodAndRemove(
    memberToRemove: string,
    overrides?: ethers.Overrides
  ): Promise<ethers.ContractTransactionResponse>;
}
