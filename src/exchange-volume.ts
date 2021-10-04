import { log, ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import { ADDRESS_ZERO, ZERO_BI } from "./constants";

import {
    OrdersFilled as OrdersFilledEvent
} from "../generated/templates/Exchange/Exchange";

import {
    Order,
    AccountDayData,
    Token,
    TokenDayData,
    Account,
} from "../generated/schema";

import {
    createAccount,
    createAccountDayData,
    createTokenDayData, getAccountDayDataId
} from "./exchange-helpers";


export function updateTokenVolume(event: OrdersFilledEvent): TokenDayData {
    // Update volume done using the token
    let token = Token.load(event.params.token.toHexString());
    token.totalVolume = token.totalVolume.plus(event.params.volume);
    token.save();

    let timestamp = event.block.timestamp.toI32();
    let dayId = timestamp / 86400;
    let dayData = TokenDayData.load(dayId.toString());
    if (dayData == null) {
        dayData = createTokenDayData(dayId.toString(), token.id);
        dayData.startTimestamp = dayId * 86400;
    }
    dayData.volume = dayData.volume.plus(event.params.volume);
    dayData.save();
    return dayData as TokenDayData;
}

// Todo: Create AccountDailyVolume for token specific rewards
export function updateAccountDailyVolume(event: OrdersFilledEvent, accountId: Address, volume: BigInt, isAccountBuyer: boolean): AccountDayData {
    let timestamp = event.block.timestamp.toI32();
    let dayId = timestamp / 86400;
    let dayData = AccountDayData.load(getAccountDayDataId(accountId.toHexString(), dayId.toString()));
    if (dayData == null) {
        dayData = createAccountDayData(accountId.toHexString(), dayId);
    }

    let account = Account.load(accountId.toHexString());
    if (account == null) {
        account = createAccount(accountId);
    }

    dayData.volume = dayData.volume.plus(volume);
    account.volume = account.volume.plus(volume);
    if (isAccountBuyer) {
        dayData.volumeAsBuyer = dayData.volumeAsBuyer.plus(volume);
        account.volumeAsBuyer = account.volumeAsBuyer.plus(volume);
    } else {
        dayData.volumeAsSeller = dayData.volumeAsSeller.plus(volume);
        account.volumeAsSeller = account.volumeAsSeller.plus(volume);
    }

    dayData.save();
    return dayData as AccountDayData;
}