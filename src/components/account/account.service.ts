import { DolphServiceHandler } from "@dolphjs/dolph/classes";
import {
  BadRequestException,
  Dolph,
  ForbiddenException,
  NotFoundException,
} from "@dolphjs/dolph/common";
import { InjectMongo } from "@dolphjs/dolph/decorators";
import { Model } from "mongoose";
import { AccountModel, IAccount, IAccRes } from "./account.model";
import { createUmiWallet } from "@/shared/helpers/generateAddress";
import { encrypt } from "@/shared/helpers/encryption";
import { hashString } from "@dolphjs/dolph/utilities";
import {
  generateOtp,
  generateOtpExpiry,
  isOtpExpired,
} from "@/shared/helpers/generators";
import { sendVerifyEmail } from "@/shared/helpers/mail_sender";

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
    };

    return { message: "Email verified successfully", data: resAcc };
  }

  async login(dto: { email: string; password: string }) {
    const account = (await this.findUser({ email: dto.email })).toObject();

    if (!account) throw new NotFoundException("Account not found");

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
    };

    return { message: "Successful", data: resAcc };
  }

  async findUser(filter: any) {
    return this.accountModel.findOne(filter);
  }
}
