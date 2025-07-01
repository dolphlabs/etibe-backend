export interface CreateChannelDto {
  channelName: string;
  channelImage: string;
  contributionAmount: string;
  startDate: number;
  gracePeriodInDays: number;
  isPublic: boolean;
  invitedMembers: string[];
  payoutOrder: number[];
}
