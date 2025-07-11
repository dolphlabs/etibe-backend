import { Schema, Document, model } from "mongoose";

export interface IAccount extends Document {
  username: string;
  img: string;
  walletAddress: string;
  email: string;
  pin: string;
  password: string;
  privateKey: string;
  isVerified: boolean;
  otp: string;
  balance: string;
  otpExpiry: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccRes {
  _id: any;
  username: string;
  img: string;
  accessToken: string;
  accessExpiration: Date;
  refreshToken: string;
  refreshExpiration: Date;
  email: string;
  isVerified: boolean;
  createdAt: Date;
  isPinSet: boolean;
  walletAddress: string;
}

export interface IAccResWithPrivateKey extends IAccRes {
  privateKey: string;
  balance: string;
}

const AccountSchema = new Schema(
  {
    username: {
      type: String,
      required: [false, "Username is required"],
      unique: true,
      sparse: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
    },
    img: {
      type: String,
      required: false,
    },
    walletAddress: {
      type: String,
      required: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    privateKey: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    balance: {
      type: String,
      default: "0.0",
    },
    password: {
      type: String,
      required: true,
    },
    pin: {
      type: String,
      required: false,
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
  },
  { timestamps: true, versionKey: false }
);

export const AccountModel = model<IAccount>("accounts", AccountSchema);
