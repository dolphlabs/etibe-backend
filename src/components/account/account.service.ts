import { DolphServiceHandler } from "@dolphjs/dolph/classes";
import {
  BadRequestException,
  Dolph,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  SuccessResponse,
} from "@dolphjs/dolph/common";
import { InjectMongo } from "@dolphjs/dolph/decorators";
import { Model } from "mongoose";
import {
  AccountModel,
  IAccount,
  IAccRes,
  IAccResWithPrivateKey,
} from "./account.model";
import { createUmiWallet } from "@/shared/helpers/generateAddress";
import { encrypt } from "@/shared/helpers/encryption";
import { compareHashedString, hashString } from "@dolphjs/dolph/utilities";
import {
  generateOtp,
  generateOtpExpiry,
  isOtpExpired,
} from "@/shared/helpers/generators";
import {
  resetPasswordEmail,
  sendVerifyEmail,
} from "@/shared/helpers/mail_sender";
import { ethers } from "ethers";
import { envConfigs } from "@/shared/configs/env.configs";

@InjectMongo("accountModel", AccountModel)
export class AccountService extends DolphServiceHandler<Dolph> {
  accountModel!: Model<IAccount>;

  constructor() {
    super("accountservice");
  }

  async createAccount(dto: { email: string; password: string }) {
    const user = await this.findUser({ email: dto.email });

    if (user) throw new BadRequestException("This email has been taken");

    const address = createUmiWallet();

    const encryptedAddress = encrypt(address.privateKey);

    const otp = generateOtp();
    const otpExpiry = generateOtpExpiry();

    const account = await this.accountModel.create({
      ...dto,
      walletAddress: address.address,
      privateKey: encryptedAddress,
      password: await hashString(dto.password, 11),
      otp,
      otpExpiry,
    });

    sendVerifyEmail(account.email, otp);

    return {
      message: "Otp has been sent successfully",
      data: { email: account.email },
    };
  }

  async verifyEmailOtp(dto: { code: string; email: string }) {
    let account = await this.findUser({ email: dto.email });

    if (!account) throw new NotFoundException("Account not found");

    if (account.otp !== dto.code) {
      throw new BadRequestException("Otp is invalid or has expired.");
    }

    if (isOtpExpired(account.otpExpiry)) {
      throw new BadRequestException("Otp is invalid or has expired.");
    }

    account.isVerified = true;
    account.otp = "";
    account.otpExpiry = null;
    account = await account.save();

    account = account.toObject() as any;

    const resAcc: Partial<IAccRes> = {
      _id: account._id.toString(),
      email: account.email,
      createdAt: account.createdAt,
      img: account.img,
      isVerified: account.isVerified,
      username: account.username,
      walletAddress: account.walletAddress,
      isPinSet: !!account.pin,
    };

    return { message: "Email verified successfully", data: resAcc };
  }

  async login(dto: { email: string; password: string }) {
    let account = await this.findUser({ email: dto.email });

    if (!account) throw new NotFoundException("Account not found");

    account = account.toObject() as any;

    if (!account.isVerified)
      throw new ForbiddenException("You need to verify your account first.");

    const resAcc: Partial<IAccRes> = {
      _id: account._id.toString(),
      email: account.email,
      createdAt: account.createdAt,
      img: account.img,
      isVerified: account.isVerified,
      username: account.username,
      walletAddress: account.walletAddress,
      isPinSet: !!account.pin,
    };

    return { message: "Successful", data: resAcc };
  }

  async updateProfile(dto: { img: string; username: string }, id: string) {
    let account = await this.findUser({ _id: id });

    if (!account) throw new NotFoundException("User not found");

    if (await this.findUser({ username: dto.username })) {
      throw new BadRequestException("Username taken by another user");
    }

    account = await this.accountModel.findOneAndUpdate(
      { email: account.email },
      { username: dto.username, img: dto.img },
      { new: true }
    );

    account = account.toObject() as any;

    const resAcc: Partial<IAccRes> = {
      _id: account._id.toString(),
      email: account.email,
      createdAt: account.createdAt,
      img: account.img,
      isVerified: account.isVerified,
      username: account.username,
      walletAddress: account.walletAddress,
      isPinSet: !!account.pin,
    };

    return { message: "Success", data: resAcc };
  }

  async getWalletAddressByUsername(username: string) {
    const account = await this.findUser({ username });

    if (account.walletAddress) {
      return { message: "Success", data: account.walletAddress };
    }

    throw new NotFoundException("wallet address not found");
  }

  async getWalletAddressesByUsernames(usernames: string[]) {
    let addresses = [];
    let users = [];

    for (const username of usernames) {
      const account = await this.findUser({ username });

      if (account.walletAddress) {
        addresses.push(account.walletAddress);
        users.push({
          username: account.username,
          img: account.img,
          email: account.email,
        });
      }
    }

    return { message: "Success", data: addresses, users };
  }

  async getProfile(user: IAccount) {
    const account = user.toObject() as any;

    const provider = new ethers.JsonRpcProvider(envConfigs.rpcUrl);

    if (!ethers.isAddress(account.walletAddress))
      throw new BadRequestException("Wallet address is invalid");

    const balanceWei = await provider.getBalance(account.walletAddress);

    const balanceEth = ethers.formatEther(balanceWei);

    await this.accountModel.updateOne({ balance: balanceEth });

    const resAcc: Partial<IAccResWithPrivateKey> = {
      _id: account._id.toString(),
      email: account.email,
      createdAt: account.createdAt,
      img: account.img,
      isVerified: account.isVerified,
      username: account.username,
      walletAddress: account.walletAddress,
      isPinSet: !!account.pin,
      privateKey: account.privateKey,
      balance: balanceEth,
    };

    return { message: "Success", data: resAcc };
  }

  async setPin(pin: string, userId: string) {
    const account = await this.findUser({ _id: userId });

    if (!account) throw new NotFoundException("User not found");

    if (account.pin) throw new BadRequestException("Pin already set.");

    account.pin = await hashString(pin, 11);

    await account.save();

    return { message: "Success" };
  }

  async confirmPin(pin: string, userId: string) {
    const account = await this.findUser({ _id: userId });

    if (!account) throw new NotFoundException("User not found");

    if (!account.pin)
      throw new BadRequestException("Pin does not exist. Set your pin");

    if (!(await compareHashedString(pin, account.pin)))
      throw new BadRequestException("Pin is incorrect");

    return { message: "success" };
  }

  async forgetPassword(dto: { email: string }) {
    let account = await this.findUser({ email: dto.email });

    if (!account)
      throw new NotFoundException("An account with this email doe snot exist");

    account.otp = await generateOtp();
    account.otpExpiry = await generateOtpExpiry();

    await account.save();

    resetPasswordEmail(account.email, account.otp);

    return {
      message: "Reset code has been sent.",
    };
  }

  async resetPassword(dto: { email: string; otp: string; password: string }) {
    let account = await this.findUser({ email: dto.email });

    if (!account)
      throw new NotFoundException("An account with this email doe snot exist");

    if (account.otp !== dto.otp)
      throw new BadRequestException("Otp is invalid or has expired");

    if (isOtpExpired(account.otpExpiry))
      throw new BadRequestException("Otp is invalid or has expired");

    account.otp = "";
    account.otpExpiry = null;
    account.password = await hashString(dto.password, 11);

    await account.save();

    return {
      message: "Password reset successful",
    };
  }

  async findUser(filter: any) {
    return this.accountModel.findOne(filter);
  }
}
