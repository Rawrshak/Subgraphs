import { log, ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import { ADDRESS_ZERO, ZERO_BI } from "./constants";

import {
    OrdersFilled as OrdersFilledEvent
} from "../generated/templates/Exchange/Exchange";

import {
    Token,
    TokenDayData,
} from "../generated/schema";

import {
    createTokenDayData
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
        dayData = createTokenDayData(dayId.toString(), event.address.toHexString());
        dayData.startTimestamp = dayId * 86400;
    }
    dayData.volume = dayData.volume.plus(event.params.volume);
    dayData.save();
    return dayData as TokenDayData;
}
