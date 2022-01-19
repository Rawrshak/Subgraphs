import { log, ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import { ONE_BI, SECONDS_PER_DAY } from "./constants";

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
    let token = Token.load(event.params.token.toHexString())!;
    token.totalVolume = token.totalVolume.plus(event.params.volume);
    token.save();

    let timestamp = event.block.timestamp.toI32();
    let dayId = timestamp / SECONDS_PER_DAY;
    let dayData = TokenDayData.load(dayId.toString());
    if (dayData == null) {
        dayData = createTokenDayData(dayId.toString(), token.id);
        dayData.startTimestamp = dayId * SECONDS_PER_DAY;
    }
    dayData.volume = dayData.volume.plus(event.params.volume);
    dayData.save();
    return dayData as TokenDayData;
}

export function updateAccountDailyVolume(event: OrdersFilledEvent, accountId: Address, volume: BigInt, isAccountBuyer: boolean): AccountDayData {
    let timestamp = event.block.timestamp.toI32();
    let dayId = timestamp / SECONDS_PER_DAY;
    let dayData = AccountDayData.load(getAccountDayDataId(accountId.toHexString(), event.params.token.toHexString(), dayId.toString()));
    
    let account = Account.load(accountId.toHexString());
    if (account == null) {
        account = createAccount(accountId);
    }

    if (dayData == null) {
        dayData = createAccountDayData(accountId.toHexString(), event.params.token.toHexString(), dayId);

        account.daysActive = account.daysActive.plus(ONE_BI);
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
    account.save();
    
    return dayData as AccountDayData;
}