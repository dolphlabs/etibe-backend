import { DolphServiceHandler } from "@dolphjs/dolph/classes";
import {
  BadRequestException,
  Dolph,
  NotFoundException,
} from "@dolphjs/dolph/common";
import { InjectMongo } from "@dolphjs/dolph/decorators";
import { Model } from "mongoose";
import { ChannelModel, IChannel } from "./channel.model";
import { EtherService, EtibeChannelContract } from "@/shared/services/ethers";
import { AccountService } from "../account/account.service";
import { decrypt } from "@/shared/helpers/encryption";
import { CreateChannelDto } from "./channel.dto";
import { ethers } from "ethers";
import { envConfigs } from "@/shared/configs/env.configs";

@InjectMongo("channelModel", ChannelModel)
export class ChannelService extends DolphServiceHandler<Dolph> {
  channelModel!: Model<IChannel>;
  etherService: EtherService;
  userService: AccountService;

  constructor() {
    super("channelservice");
    this.userService = new AccountService();
  }

  async createChannel(userId: string, data: CreateChannelDto) {
    try {
      const {
        channelImage,
        channelName,
        contributionAmount,
        gracePeriodInDays,
        invitedMembers,
        isPublic,
        payoutOrder,
        startDate,
      } = data;
      const user = await this.userService.findUser({ _id: userId });

      if (!user) throw new NotFoundException("User not found");

      const decryptedPrivateKey = decrypt(user.privateKey);

      this.etherService = new EtherService(decryptedPrivateKey);
      // this.etherService = new EtherService(envConfigs.testPrivateKey);

      if (
        !channelName ||
        !contributionAmount ||
        !startDate ||
        !invitedMembers ||
        !payoutOrder ||
        !Array.isArray(invitedMembers) ||
        !Array.isArray(payoutOrder)
      ) {
        throw new BadRequestException("Missing or invalid required fields.");
      }

      const _contributionAmount = ethers.parseEther(
        contributionAmount.toString()
      );

      const rawStartDate = BigInt(data.startDate);

      const bufferInSeconds = BigInt(2 * 24 * 60 * 60);

      const _startDate = rawStartDate + bufferInSeconds;
      console.log("StartDate: ", _startDate);
      const _payoutOrder = payoutOrder.map((order: number) => BigInt(order));
      const _invitedMembers = invitedMembers.map((memberAddr: string) => {
        // Ethers v6: getAddress will throw if not a valid address string
        return ethers.getAddress(memberAddr);
      });

      console.log(
        `Creating channel: ${channelName}, Amount: ${contributionAmount}, Start: ${startDate}`
      );
      console.log(
        `Invited Members: ${invitedMembers}, Payout Order: ${payoutOrder}`
      );

      const tx = await this.etherService.factoryContract().createChannel(
        channelName,
        channelImage,
        _contributionAmount,
        _startDate,
        gracePeriodInDays,
        isPublic,
        _invitedMembers,
        _payoutOrder
        // { gasLimit: 8000000 }
      );

      console.log(`Transaction sent, hash: ${tx.hash}`);
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        const channelCreatedEvent = receipt.logs.find(
          (log) =>
            log instanceof ethers.EventLog &&
            log.eventName === "EtibeChannelCreated"
        ) as ethers.EventLog | undefined;

        let newChannelAddress: string | undefined;
        if (channelCreatedEvent && channelCreatedEvent.args) {
          newChannelAddress = channelCreatedEvent.args.channelAddress;
          console.log("New channel address from event:", newChannelAddress);
        }
        return {
          message: "Channel Created Successfully",
          transactionHash: receipt.hash,
          channelAddress: newChannelAddress,
          blockNumber: receipt.blockNumber,
        };
      } else {
        return {
          message: "Channel creation transaction failed.",
          transactionHash: tx.hash,
        };
      }
    } catch (error: any) {
      console.error("Error creating channel:", error);
      // Specifically log the receipt logs if they exist
      if (error.receipt && error.receipt.logs) {
        console.log("Transaction Receipt Logs (before revert):");
        error.receipt.logs.forEach((log: any) => {
          // You might need to parse these logs if they're not already parsed
          // For simple event parsing:
          try {
            if (
              log.topics &&
              log.topics[0] === ethers.id("DebugLog(string,uint256)")
            ) {
              const message = new ethers.AbiCoder().decode(
                ["string", "uint256"],
                log.data
              );
              console.log(`  DebugLog: ${message[0]} (Value: ${message[1]})`);
            } else if (
              log.topics &&
              log.topics[0] === ethers.id("DebugAddress(string,address)")
            ) {
              const message = new ethers.AbiCoder().decode(
                ["string", "address"],
                log.data
              );
              console.log(
                `  DebugAddress: ${message[0]} (Address: ${message[1]})`
              );
            }
          } catch (e) {
            // Fallback for unparsed logs or other events
            console.log("  Raw Log:", log);
          }
        });
      }
    }
  }

  async getChannelContract(userId: string, address: string) {
    if (!ethers.isAddress(address)) {
      throw new BadRequestException("Invalid channel address provided.");
    }

    const user = await this.userService.findUser({ _id: userId });

    if (!user) throw new NotFoundException("User not found");

    const decryptedPrivateKey = decrypt(user.privateKey);

    this.etherService = new EtherService(decryptedPrivateKey);
    // this.etherService = new EtherService(envConfigs.testPrivateKey);

    const etibeChannelContract = this.etherService.channelContract(address);
    return etibeChannelContract;
  }

  async getChannelDetails(contract: EtibeChannelContract) {
    const details = await contract.getChannelDetails();

    const contributionInEther = ethers.formatEther(details[1]);

    // Convert gracePeriod from seconds to days
    const gracePeriodInSeconds = Number(details[9]);
    const secondsInADay = 24 * 60 * 60;
    const gracePeriodInDays = gracePeriodInSeconds / secondsInADay;

    const data = {
      name: details[0],
      contribution: contributionInEther,
      balance: details[2].toString(),
      locked: details[3],
      size: Number(details[4]),
      currentMonth: Number(details[5]),
      complete: details[6],
      createdDate: Number(details[7]),
      startDate: Number(details[8]),
      gracePeriod: gracePeriodInDays,
      image: details[10],
      publicStatus: details[11],
    };

    return { message: "Channel fetched successfully", data };
  }

  async getMemberStatus(contract: EtibeChannelContract, memberAddress: string) {
    if (!ethers.isAddress(memberAddress)) {
      throw new BadRequestException("Invalid member address provided.");
    }

    const memberStatus = await contract.getMemberStatus(memberAddress);

    const MemberStatusEnum = ["Invited", "Active", "Removed", "PaidOut"];

    return {
      status: MemberStatusEnum[Number(memberStatus[0])],
      lastPaidMonth: Number(memberStatus[1]),
      receivedMonth: Number(memberStatus[2]),
      payoutMonth: Number(memberStatus[3]),
    };
  }

  async acceptInvite(contract: EtibeChannelContract) {
    const tx = await contract.acceptInvite();

    console.log(`Accept invite tx sent, hash: ${tx.hash}`);
    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      return {
        message: "Invite accepted successfully!",
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } else {
      throw new BadRequestException("Accept invite transaction failed.");
    }
  }
}
