import { DolphServiceHandler } from "@dolphjs/dolph/classes";
import { Dolph, IPayload, UnauthorizedException } from "@dolphjs/dolph/common";
import {
  generateJWTwithHMAC,
  verifyJWTwithHMAC,
} from "@dolphjs/dolph/utilities";
import { InjectMongo } from "@dolphjs/dolph/decorators";
import { IToken, TokenModel } from "./token.model";
import { Model } from "mongoose";
import { envConfigs } from "@/shared/configs/env.configs";

@InjectMongo("tokenModel", TokenModel)
export class TokenService extends DolphServiceHandler<Dolph> {
  private tokenModel!: Model<IToken>;
  constructor() {
    super("tokenservice");
  }

  public async generateToken(userId: string) {
    const accessDuration = +envConfigs.jwt.expiration;
    const refreshDuration = +envConfigs.jwt.expiration;

    const now = new Date();
    const accessExpirationDate = new Date(
      now.getTime() + accessDuration * 60000
    );
    const refreshExpirationDate = new Date(
      now.getTime() + refreshDuration * 60000
    );

    const accessToken = this.signToken(userId, accessExpirationDate);
    const refreshToken = this.signToken(userId, refreshExpirationDate);

    await this.tokenModel.create({
      token: refreshToken,
      expires: refreshExpirationDate.toISOString(),
      type: "refresh",
      accountId: userId,
    });

    return {
      accessToken,
      refreshToken,
      accessExpiration: accessExpirationDate,
      refreshExpiration: refreshExpirationDate,
    };
  }

  public async verifyRefreshToken(token: string) {
    const refreshToken = await this.tokenModel.findOne({
      token,
      type: "refresh",
    });

    if (!refreshToken)
      throw new UnauthorizedException("Cannot refresh user session");

    const refreshTokenDoc = await verifyJWTwithHMAC({
      token: refreshToken.token,
      secret: envConfigs.jwt.secret,
    });

    if (!refreshTokenDoc)
      throw new UnauthorizedException("Cannot refresh user session");

    return refreshTokenDoc;
  }

  private signToken(userId: string, expires: Date): string {
    const now = Math.floor(Date.now() / 1000); // in seconds
    const exp = Math.floor(expires.getTime() / 1000); // in seconds

    const payload: IPayload = {
      exp,
      sub: userId,
      iat: now,
    };

    return generateJWTwithHMAC({ payload, secret: envConfigs.jwt.secret });
  }
}
