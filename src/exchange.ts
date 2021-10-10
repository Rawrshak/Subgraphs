import { log, ByteArray, BigInt, Address, crypto, store } from "@graphprotocol/graph-ts"
import { ADDRESS_ZERO, ONE_BI, ZERO_BI } from "./constants";

import { 
    AddressResolver as Resolver,
    Exchange,
    Order,
    TokenEscrow,
    Token,
    Asset,
    Account,
    OrderFill,
    UserRoyalty
} from "../generated/schema";

import {
    AddressResolver as AddressResolverContract,
    AddressRegistered as AddressRegisteredEvent
} from "../generated/AddressResolver/AddressResolver";

import {
    OrderPlaced as OrderPlacedEvent,
    OrdersFilled as OrdersFilledEvent,
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
    createOrderFill,
    createUserRoyalty,
    getAssetId,
    getOrderFillId,
    getUserRoyaltyId,
} from "./exchange-helpers";

import { updateAccountDailyVolume, updateTokenVolume } from "./exchange-volume";
  
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

    // todo: update to only open orders; subtract when filled or cancelled
    if (event.params.order.isBuyOrder) {
        ownerAcc.numOfOpenBuyOrders = ownerAcc.numOfOpenBuyOrders.plus(ONE_BI);
    } else {
        ownerAcc.numOfOpenSellOrders = ownerAcc.numOfOpenSellOrders.plus(ONE_BI);
    }
    ownerAcc.save();

    // Create Order
    let order = createOrder(event.params.orderId, assetId, event.params.order.owner.toHexString());
    order.type = (event.params.order.isBuyOrder) ? "Buy" : "Sell";
    order.createdAtTimestamp = event.block.timestamp;
    order.price = event.params.order.price;
    order.amountOrdered = event.params.order.amount;
    order.save();
    
    // Update exchange data
    let exchange = Exchange.load(event.address.toHexString())!;
    exchange.numOfOrders = exchange.numOfOrders.plus(ONE_BI);
    if (event.params.order.isBuyOrder) {
        exchange.numOfBuyOrders = exchange.numOfBuyOrders.plus(ONE_BI);
    } else {
        exchange.numOfSellOrders = exchange.numOfSellOrders.plus(ONE_BI);
    }
    exchange.save();
}

export function handleOrdersFilled(event: OrdersFilledEvent): void {
    let orderFiller = Account.load(event.params.from.toHexString());
    if (orderFiller == null) {
        orderFiller = createAccount(event.params.from);
    }

    // Check asset and token - must already exist
    let assetId = getAssetId(event.params.asset.contentAddress.toHexString(), event.params.asset.tokenId.toString());
    let asset = Asset.load(assetId)!;
    let token = Token.load(event.params.token.toHexString())!;

    // These should be the same lengths, checked by the smart contract
    let orderIds = event.params.orderIds;
    let orderAmounts = event.params.amounts;
    let isBuyOrder = false;
    for (let j = 0; j < orderIds.length; ++j) {
        if (orderAmounts[j].equals(ZERO_BI)) {
            continue;
        }

        let orderId = orderIds[j];
        
        // create OrderFill object
        let orderFillId = getOrderFillId(orderId.toHexString(), event.transaction.hash.toHexString());
        let orderFill = createOrderFill(orderFillId, orderFiller.id, orderId.toHexString(), token.id);

        // Update order status
        let order = Order.load(orderId.toHexString())!;
        isBuyOrder = order.type == "Buy" ? true : false;

        // get order data and update orderFill object
        orderFill.amount = orderAmounts[j];
        orderFill.pricePerItem = order.price;
        orderFill.totalPrice = orderAmounts[j].times(order.price);
        orderFill.save();

        // Add user volume to the buy and the orderFiller
        let orderOwner = Account.load(order.owner)!;

        order.amountFilled = order.amountFilled.plus(orderAmounts[j]);
        let amountLeft = order.amountOrdered.minus(order.amountFilled);
        if (amountLeft == ZERO_BI) {
            order.status = "Filled";
            order.filledAtTimestamp = event.block.timestamp;
            orderOwner.numOfFilledOrders = orderOwner.numOfFilledOrders.plus(ONE_BI);
            if (order.type == "Buy") {
                orderOwner.numOfOpenBuyOrders = orderOwner.numOfOpenBuyOrders.minus(ONE_BI);
            } else {
                orderOwner.numOfOpenSellOrders = orderOwner.numOfOpenSellOrders.minus(ONE_BI);
            }
        } else {
            order.status = "PartiallyFilled";
        }
        order.save();
        orderOwner.save();

        // Update daily volume for the order owner
        updateAccountDailyVolume(event, orderOwner.address as Address, orderFill.totalPrice, isBuyOrder);
    }

    updateAccountDailyVolume(event, orderFiller.address as Address, event.params.volume, !isBuyOrder);
    orderFiller.save();

    // Add to asset volume
    asset.assetVolumeTransacted = asset.assetVolumeTransacted.plus(event.params.totalAssetsAmount);
    asset.save();

    updateTokenVolume(event);
}

export function handleOrdersDeleted(event: OrdersDeletedEvent): void {
    let orderIds = event.params.orderIds;
    for (let j = 0; j < orderIds.length; ++j) {
        let orderId = orderIds[j];

        // Update order status
        let order = Order.load(orderId.toHexString())!;
        order.status = "Cancelled";
        order.cancelledAtTimestamp = event.block.timestamp;
        order.save();
        
        let orderOwner = Account.load(order.owner)!;
        if (order.type == "Buy") {
            orderOwner.numOfOpenBuyOrders = orderOwner.numOfOpenBuyOrders.minus(ONE_BI);
        } else {
            orderOwner.numOfOpenSellOrders = orderOwner.numOfOpenSellOrders.minus(ONE_BI);
        }
        orderOwner.numOfCancelledOrders = orderOwner.numOfCancelledOrders.plus(ONE_BI);
        orderOwner.save();
    }
}

export function handleOrdersClaimed(event: OrdersClaimedEvent): void {
    let orderIds = event.params.orderIds;
    for (let j = 0; j < orderIds.length; ++j) {
        let orderId = orderIds[j];

        // Update order status
        let order = Order.load(orderId.toHexString())!;
        
        // Only set to 'Claimed' if the order is fully filled. If it is not, maintain PartiallyFilled 
        // status. All the necessary checks are done on the smart contract so no need to verify incoming
        // data.
        if (order.status == "Filled") {
            order.status = "Claimed";
        }

        // Update lastClaimedAtTimestamp every time (even for partially filled orders)
        order.lastClaimedAtTimestamp = event.block.timestamp;
        order.save();
    }
}

export function handleClaimedRoyalties(event: ClaimedRoyaltiesEvent): void {
    let user = event.params.owner;
    let tokens = event.params.tokens;
    let amounts = event.params.amounts;

    for (let i = 0; i < tokens.length; ++i) {
        let royaltyId = getUserRoyaltyId(tokens[i].toHexString(), user.toHexString());
        let royalty = UserRoyalty.load(royaltyId);
        if (royalty == null) {
            royalty = createUserRoyalty(royaltyId, tokens[i].toHexString(), user.toHexString());
        }
        royalty.claimedAmount = royalty.claimedAmount.plus(amounts[i]);
        royalty.save();
    }
}