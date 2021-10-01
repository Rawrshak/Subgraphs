import { log, ByteArray, BigInt, Address, crypto, store } from "@graphprotocol/graph-ts"
import { ADDRESS_ZERO, ONE_BI, ZERO_BI } from "./constants";

import { 
    AddressResolver as Resolver,
    Exchange,
    TokenEscrow,
    Token,
    Asset,
    Account
} from "../generated/schema";

import {
    AddressResolver as AddressResolverContract,
    AddressRegistered as AddressRegisteredEvent
} from "../generated/AddressResolver/AddressResolver";

import {
    OrderPlaced as OrderPlacedEvent,
    BuyOrdersFilled as BuyOrdersFilledEvent,
    SellOrdersFilled as SellOrdersFilledEvent,
    OrdersDeleted as OrdersDeletedEvent,
    OrdersClaimed as OrdersClaimedEvent
} from "../generated/templates/Exchange/Exchange";

import {
    ClaimedRoyalties as ClaimedRoyaltiesEvent,
    AddedTokenSupport as AddedTokenSupportEvent
} from "../generated/templates/Erc20Escrow/Erc20Escrow";

import {
    Exchange as ExchangeTemplate,
    Erc20Escrow as Erc20EscrowTemplate
} from '../generated/templates';
  
import {
    Exchange as ExchangeContract,
} from "../generated/templates/Exchange/Exchange";
  
import {
    createAddressResolver,
    createExchange,
    createTokenEscrow,
    createToken,
    createOrder,
    createAsset,
    createAccount,
    getAssetId
} from "./exchange-helpers";
  
export function handleAddressRegistered(event: AddressRegisteredEvent): void {
    let resolver = Resolver.load(event.address.toHexString());
    if (resolver == null) {
      resolver = createAddressResolver(event.address);
    }
    
    if (event.params.id.toString() == "0xeef64103") {
        // Exchange Hash = 0xeef64103
        // Start Listening for Exchange Events and create Exchange entity
        ExchangeTemplate.create(event.params.contractAddress);
        let exchange = Exchange.load(event.params.contractAddress.toHexString());
        if (exchange == null) {
            exchange = createExchange(event.params.contractAddress);
        }
    } else if (event.params.id.toString() == "0x29a264aa") {
        // ERC20 Escrow Hash = 0x29a264aa
        // Start Listening for ERC20Escrow Events and create token escrow entity
        Erc20EscrowTemplate.create(event.params.contractAddress);
        let tokenEscrow = TokenEscrow.load(event.params.contractAddress.toHexString());
        if (tokenEscrow == null) {
            tokenEscrow = createTokenEscrow(event.params.contractAddress);
        }
    } else {
        log.info('-------- LOG: Resolver - Ignoring registered address: {}', [event.params.id.toHexString()]);
    }
}

export function handleAddedTokenSupport(event: AddedTokenSupportEvent): void {
    let token = Token.load(event.params.token.toHexString());
    if (token == null) {
        token = createToken(event.params.token, event.address);
    }
}

export function handleOrderPlaced(event: OrderPlacedEvent): void {
    let exchange = Exchange.load(event.address.toHexString());

    let assetId = getAssetId(event.params.order.asset.contentAddress.toHexString(), event.params.order.asset.tokenId.toHexString());

    // Create asset object if it doesn't already exist
    let asset = Asset.load(assetId);
    if (asset == null) {
        asset = createAsset(assetId, event.params.order.asset.contentAddress, event.params.order.asset.tokenId);
    }

    // Create Owner account object if it doesn't already exist
    let ownerAcc = Account.load(event.params.order.owner.toHexString());
    if (ownerAcc == null) {
        ownerAcc = createAccount(event.params.order.owner);
    }

    // Create Order
    let order = createOrder(event.params.orderId, assetId, event.params.order.owner.toHexString());
    order.dateCreated = event.block.timestamp;
}

export function handleBuyOrdersFilled(event: BuyOrdersFilledEvent): void {
    // Todo:
}

export function handleSellOrdersFilled(event: SellOrdersFilledEvent): void {
    // Todo:
}

export function handleOrdersDeleted(event: OrdersDeletedEvent): void {
    // Todo:
}

export function handleOrdersClaimed(event: OrdersClaimedEvent): void {
    // Todo:
}

export function handleClaimedRoyalties(event: ClaimedRoyaltiesEvent): void {
    // Todo:
}