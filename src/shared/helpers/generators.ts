import { randomBytes } from "crypto";

export const generateReferenceId = (length: number = 12): string => {
  const characters = "234ABCDEFGHIJKLMNOPQRSTUVXWZY0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
};

export const generateRandomNumbers = (
  min: number,
  max: number,
  len: number
) => {
  let result = "";
  for (let i = 0; i < len; i++) {
    const tempNum =
      (randomBytes(4).readUint32BE() / 0xffffffff) * (max - min + 1) + min;

    result += Math.floor(tempNum % 10).toString();
  }

  return result;
};

export const generateOtp = () => {
  return generateRandomNumbers(0, 9, 6);
};

export const generateOtpExpiry = (minutes = 10) => {
  const now = new Date();
  // 10 minutes from now
  return new Date(now.getTime() + minutes * 60 * 1000);
};

export const isOtpExpired = (expiryDate) => {
  const now = new Date();
  return now > new Date(expiryDate);
};
