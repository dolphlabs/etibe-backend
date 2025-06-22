import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { envConfigs } from "../configs/env.configs";

const algorithm = "aes-256-cbc";
const key = scryptSync(envConfigs.jwt.secret, "salt", 32);
const iv = randomBytes(16);

export const encrypt = (data: string): string => {
  const cipher = createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
};

export const decrypt = (data: string): string => {
  const [ivHex, encryptedText] = data.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};
