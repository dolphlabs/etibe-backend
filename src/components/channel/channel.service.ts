import { DolphServiceHandler } from "@dolphjs/dolph/classes";
import {
  BadRequestException,
  Dolph,
  ForbiddenException,
  InternalServerErrorException,
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

  async createChannel(userId: string, balance: string, data: CreateChannelDto) {
    if (parseFloat(balance) <= parseFloat(data.contributionAmount) - 0.00005)
      throw new BadRequestException(
        "Insufficient balance. Please fund your address to proceed with this request."
      );

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
    const balance = ethers.formatEther(details[2]);

    // Convert gracePeriod from seconds to days
    const gracePeriodInSeconds = Number(details[9]);
    const secondsInADay = 24 * 60 * 60;
    const gracePeriodInDays = gracePeriodInSeconds / secondsInADay;

    const data = {
      name: details[0],
      contribution: contributionInEther,
      balance: balance,
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

  async acceptInvite(contract: EtibeChannelContract, balance: string) {
    // if (parseFloat(balance) <= 0.00005)
    //   throw new BadRequestException(
    //     "Insufficient balance. Please fund your address to proceed with this request."
    //   );

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

  async lockChannel(contract: EtibeChannelContract) {
    const tx = await contract.lockChannel();

    console.log(`Lock channel tx sent, hash: ${tx.hash}`);
    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      return {
        message: "Channel locked successfully",
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } else {
      throw new BadRequestException("Lock channel transaction failed");
    }
  }

  async fetchActiveMembers(contract: EtibeChannelContract) {
    const memberCount = Number(await contract.getMemberAddressesLength());
    const activeMembers = [];
    const MemberStatusEnum = ["Invited", "Active", "Removed", "PaidOut"];

    for (let i = 0; i < memberCount; i++) {
      const memberAddress = await contract.memberAddresses(BigInt(i));
      const [status, lastPaidMonth, receivedMonth, payoutMonth] =
        await contract.getMemberStatus(memberAddress);

      if (ethers.isAddress(memberAddress)) {
        const user = await this.userService.findUser({
          walletAddress: memberAddress,
        });

        if (user) {
          activeMembers.push({
            walletAddress: memberAddress,
            status: MemberStatusEnum[Number(status)],
            lastPaidMonth: Number(lastPaidMonth),
            receivedMonth: Number(receivedMonth),
            payoutMonth: Number(payoutMonth),
            username: user.username,
            img: user.img,
            userId: user._id,
          });
        }
      }
    }
    return { data: activeMembers };
  }

  async fetchAllDeployedChannels(userId: string) {
    const user = await this.userService.findUser({ _id: userId });

    if (!user) throw new NotFoundException("User not found");

    const decryptedPrivateKey = decrypt(user.privateKey);

    this.etherService = new EtherService(decryptedPrivateKey);

    const channelCount = Number(
      await this.etherService.factoryContract().getChannelCount()
    );

    const allChannels = [];

    for (let i = 0; i < channelCount; i++) {
      const channelAddress = await this.etherService
        .factoryContract()
        .getChannelAddress(BigInt(i));

      let channelDetails = {};
      try {
        const channelContractInstance =
          this.etherService.channelContract(channelAddress);

        const name = await channelContractInstance.channelName();
        const adminAddress = await channelContractInstance.admin();
        const contributionAmount =
          await channelContractInstance.contributionAmount();
        const isLockedStatus = await channelContractInstance.isLocked();
        const isCompleteStatus = await channelContractInstance.isComplete();
        const channelImage = await channelContractInstance.channelImage();
        const channelSize = await channelContractInstance.channelSize();
        const creationDate = await channelContractInstance.creationDate();

        let admin = {
          address: adminAddress.toString(),
        } as any;
        const adminRes = await this.userService.findUser({
          walletAddress: adminAddress,
        });

        if (adminRes) {
          admin = {
            username: adminRes.username,
            img: adminRes.img,
            userId: adminRes._id.toString(),
            address: adminAddress.toString(),
          };
        }

        channelDetails = {
          name: name,
          admin: admin,
          contributionAmount: ethers.formatEther(contributionAmount),
          image: channelImage,
          size: channelSize.toString(),
          creationDate: creationDate.toString(),
          isLocked: isLockedStatus,
          isComplete: isCompleteStatus,
        };
      } catch (detailError) {
        console.warn(
          `Could not fetch details for channel ${channelAddress}:`,
          detailError
        );
        channelDetails = {
          error: "Could not fetch details",
          message: (detailError as Error).message,
        };
      }

      allChannels.push({
        index: i.toString(),
        address: channelAddress.toString(),
        ...channelDetails,
      });
    }

    return {
      data: { totalChannels: channelCount, channels: allChannels },
    };
  }

  async makeContribution(
    contract: EtibeChannelContract,
    amount: string,
    balance: string
  ) {
    // if (parseFloat(balance) <= 0.00005)
    //   throw new BadRequestException(
    //     "Insufficient balance. Please fund your address to proceed with this request."
    //   );

    const valueInWei = ethers.parseEther(amount);

    console.log(
      `Attempting to make contribution of ${amount} ETH (${valueInWei.toString()} Wei) to channel ${await contract.getAddress()}`
    );

    const tx = await contract.makeContribution({ value: valueInWei });

    console.log(`Contribution transaction sent, hash: ${tx.hash}`);
    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      return {
        message: "Contribution made successfully!",
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } else {
      throw new BadRequestException(
        "Contribution transaction failed or reverted."
      );
    }
  }

  async makeMonthlyDisbursement(
    contract: EtibeChannelContract,
    address: string,
    userAddress: string
  ) {
    try {
      console.log(
        `Attempting to process monthly payout for channel: ${address}`
      );

      const admin = await contract.admin();

      if (admin !== userAddress)
        throw new ForbiddenException("Only admin can trigger this request");

      // Call the processMonthlyPayout function on the contract
      const tx = await contract.processMonthlyPayout({});

      console.log(`Payout transaction sent, hash: ${tx.hash}`);

      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        const payoutMadeEvent = receipt.logs.find(
          (log) =>
            log instanceof ethers.EventLog && log.eventName === "PayoutMade"
        ) as ethers.EventLog | undefined;

        let recipientAddress: string | undefined;
        let payoutAmount: string | undefined;

        if (payoutMadeEvent && payoutMadeEvent.args) {
          recipientAddress = payoutMadeEvent.args.recipient;
          // Convert to ETH
          payoutAmount = ethers.formatEther(payoutMadeEvent.args.amount);
          console.log(
            `Payout successful! Recipient: ${recipientAddress}, Amount: ${payoutAmount} ETH`
          );
        }

        return {
          message: "Monthly payout processed successfully!",
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          recipient: recipientAddress,
          amountEth: payoutAmount,
        };
      } else {
        throw new InternalServerErrorException(
          "Monthly payout transaction failed or reverted."
        );
      }
    } catch (error: any) {
      console.error("Error processing monthly payout:", error);
      // Be specific about errors from contract reverts
      let errorMessage = "Failed to process monthly payout.";
      if (error.message.includes("Etibe: Payout period not yet reached")) {
        errorMessage = "Payout not due yet for this month.";
      } else if (
        error.message.includes("Etibe: Insufficient funds in contract")
      ) {
        errorMessage = "Insufficient funds in the channel contract.";
      } else if (
        error.message.includes("Etibe: Not all active members have contributed")
      ) {
        errorMessage =
          "Not all active members have contributed for this cycle month.";
      } else if (error.message.includes("Etibe: Recipient has been removed")) {
        errorMessage =
          "Recipient for this month has been removed and cannot receive payout.";
      } else if (
        error.message.includes("Only admin can trigger this request")
      ) {
        errorMessage = "Only admin can trigger this request";
      } else if (
        error.message.includes(
          "Etibe: No recipient found for the current month"
        )
      ) {
        errorMessage =
          "No recipient is scheduled for payout in the current month.";
      }
      throw new BadRequestException(errorMessage);
    }
  }
}
