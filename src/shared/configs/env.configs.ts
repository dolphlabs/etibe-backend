import * as Joi from "joi";
import { config } from "dotenv";

config({});

const envSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().default("development"),
    JWT_SECRET: Joi.string().default("httpjwtverysecuresecret"),
    JWT_ACCESS_EXPIRATION: Joi.number().default(800),
    SMTP_PASSWORD_DEV: Joi.string()
      .description("Development SMTP password")
      .required(),
    SMTP_PASSWORD_PROD: Joi.string().description("Production SMTP password"),
    SMTP_USERNAME_DEV: Joi.string()
      .description("Development SMTP username")
      .required(),
    SMTP_USERNAME_PROD: Joi.string().description("Production SMTP username"),
    RPC_URL: Joi.string()
      .description("RPC URL")
      .default("https://devnet.moved.network"),
    CONTRACT_ADDRESS: Joi.string().description("Contract Address"),
    TEST_PRIVATE_KEY: Joi.string().description("Private Key"),
  })
  .unknown();

const { value: envVars, error } = envSchema
  .prefs({ errors: { label: "key" } })
  .validate(process.env);

if (error) console.error(`Configs Loader error: ${error.message}`);

export const isProd = () => envVars.NODE_ENV === "production";
export const isDev = () => envVars.NODE_ENV === "development";
export const isTest = () => envVars.NODE_ENV === "test";

export const envConfigs = {
  smtp: {
    password: isProd() ? envVars.SMTP_PASSWORD_PROD : envVars.SMTP_PASSWORD_DEV,
    username: isProd() ? envVars.SMTP_USERNAME_PROD : envVars.SMTP_USERNAME_DEV,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiration: envVars.JWT_ACCESS_EXPIRATION,
  },
  env: envVars.NODE_ENV,
  port: process.env.PORT || 5500,
  rpcUrl: envVars.RPC_URL,
  contractAddress: envVars.CONTRACT_ADDRESS,
  testPrivateKey: envVars.TEST_PRIVATE_KEY,
};
