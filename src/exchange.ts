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
    OrderClaimTransaction,
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
    concat,
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
    
    if (event.params.id.toHexString() == "0xeef64103") {
        // Exchange Hash = 0xeef64103
        // Start Listening for Exchange Events and create Exchange entity
        ExchangeTemplate.create(event.params.contractAddress);
        let exchange = Exchange.load(event.params.contractAddress.toHexString());
        if (exchange == null) {
            exchange = createExchange(event.params.contractAddress);
            resolver.exchange = exchange.id;
            resolver.save();
        }
    } else if (event.params.id.toHexString() == "0x29a264aa") {
        // ERC20 Escrow Hash = 0x29a264aa
        // Start Listening for ERC20Escrow Events and create token escrow entity
        Erc20EscrowTemplate.create(event.params.contractAddress);
        let tokenEscrow = TokenEscrow.load(event.params.contractAddress.toHexString());
        if (tokenEscrow == null) {
            tokenEscrow = createTokenEscrow(event.params.contractAddress);
            resolver.tokenEscrow = tokenEscrow.id;
            resolver.save();
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
    let assetId = getAssetId(event.params.order.asset.contentAddress.toHexString(), event.params.order.asset.tokenId.toString());

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

    ownerAcc.ordersCount = ownerAcc.ordersCount.plus(ONE_BI);
    ownerAcc.activeOrdersCount = ownerAcc.activeOrdersCount.plus(ONE_BI);
    if (event.params.order.isBuyOrder) {
        ownerAcc.activeBuyOrders = ownerAcc.activeBuyOrders.plus(ONE_BI);
    } else {
        ownerAcc.activeSellOrders = ownerAcc.activeSellOrders.plus(ONE_BI);
    }
    ownerAcc.save();
    
    let exchange = Exchange.load(event.address.toHexString())!;

    // Create Order
    let order = createOrder(event.params.orderId, assetId, event.params.order.token.toHexString(), event.params.order.owner.toHexString(), exchange.id);
    order.type = (event.params.order.isBuyOrder) ? "Buy" : "Sell";
    order.createdAtTimestamp = event.block.timestamp;
    order.price = event.params.order.price;
    order.amountOrdered = event.params.order.amount;
    order.save();
    
    // Update exchange data
    exchange.totalOrdersCount = exchange.totalOrdersCount.plus(ONE_BI);
    exchange.totalActiveOrdersCount = exchange.totalActiveOrdersCount.plus(ONE_BI);
    if (event.params.order.isBuyOrder) {
        exchange.totalActiveBuyOrdersCount = exchange.totalActiveBuyOrdersCount.plus(ONE_BI);
        exchange.totalBuyOrdersCount = exchange.totalBuyOrdersCount.plus(ONE_BI);
    } else {
        exchange.totalActiveSellOrdersCount = exchange.totalActiveSellOrdersCount.plus(ONE_BI);
        exchange.totalSellOrdersCount = exchange.totalSellOrdersCount.plus(ONE_BI);
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
    
    let exchange = Exchange.load(event.address.toHexString())!;

    for (let j = 0; j < orderIds.length; ++j) {
        if (orderAmounts[j].equals(ZERO_BI)) {
            continue;
        }

        let orderId = orderIds[j];
        
        // create OrderFill object
        let orderFillId = getOrderFillId(orderId.toHexString(), event.transaction.hash.toHexString());
        let orderFill = createOrderFill(orderFillId, orderFiller.id, orderId.toHexString(), token.id, exchange.id);

        orderFiller.orderFillsCount = orderFiller.orderFillsCount.plus(ONE_BI);
        orderFiller.save();

        // Update order status
        let order = Order.load(orderId.toHexString())!;
        isBuyOrder = order.type == "Buy" ? true : false;

        // Update exchange data
        exchange.totalOrderFillsCount = exchange.totalOrderFillsCount.plus(ONE_BI);
        if (isBuyOrder) {
            exchange.totalBuyOrderFillsCount = exchange.totalBuyOrderFillsCount.plus(ONE_BI);
        } else {
            exchange.totalSellOrderFillsCount = exchange.totalSellOrderFillsCount.plus(ONE_BI);
        }

        // get order data and update orderFill object
        orderFill.amount = orderAmounts[j];
        orderFill.pricePerItem = order.price;
        orderFill.totalPrice = orderAmounts[j].times(order.price);
        orderFill.createdAtTimestamp = event.block.timestamp;
        orderFill.save();

        // Add user volume to the buy and the orderFiller
        let orderOwner = Account.load(order.owner)!;

        order.amountFilled = order.amountFilled.plus(orderAmounts[j]);
        let amountLeft = order.amountOrdered.minus(order.amountFilled);
        if (amountLeft == ZERO_BI) {
            order.status = "Filled";
            order.filledAtTimestamp = event.block.timestamp;
            orderOwner.filledOrdersCount = orderOwner.filledOrdersCount.plus(ONE_BI);
            orderOwner.activeOrdersCount = orderOwner.activeOrdersCount.minus(ONE_BI);
            if (order.type == "Buy") {
                orderOwner.activeBuyOrders = orderOwner.activeBuyOrders.minus(ONE_BI);
            } else {
                orderOwner.activeSellOrders = orderOwner.activeSellOrders.minus(ONE_BI);
            }

            // Update Active orders stats
            exchange.totalActiveOrdersCount = exchange.totalActiveOrdersCount.minus(ONE_BI);
            if (isBuyOrder) {
                exchange.totalActiveBuyOrdersCount = exchange.totalActiveBuyOrdersCount.minus(ONE_BI);
            } else {
                exchange.totalActiveSellOrdersCount = exchange.totalActiveSellOrdersCount.minus(ONE_BI);
            }
        } else {
            order.status = "PartiallyFilled";
        }
        order.save();
        orderOwner.save();

        // Note: changetype is for downcasting from Bytes to Address
        // Update daily volume for the order owner
        updateAccountDailyVolume(event, changetype<Address>(orderOwner.address), orderFill.totalPrice, isBuyOrder);
    }

    exchange.save();

    // Note: changetype is for downcasting from Bytes to Address
    updateAccountDailyVolume(event, changetype<Address>(orderFiller.address), event.params.volume, !isBuyOrder);

    // Add to asset volume
    asset.assetVolumeTransacted = asset.assetVolumeTransacted.plus(event.params.totalAssetsAmount);
    asset.save();

    updateTokenVolume(event);
}

export function handleOrdersDeleted(event: OrdersDeletedEvent): void {
    let orderIds = event.params.orderIds;
    let exchange = Exchange.load(event.address.toHexString())!;
    for (let j = 0; j < orderIds.length; ++j) {
        let orderId = orderIds[j];

        // Update order status
        let order = Order.load(orderId.toHexString())!;
        order.status = "Cancelled";
        order.cancelledAtTimestamp = event.block.timestamp;
        order.amountClaimed = order.amountFilled;
        order.save();
        
        let orderOwner = Account.load(order.owner)!;
        orderOwner.activeOrdersCount = orderOwner.activeOrdersCount.minus(ONE_BI);
        if (order.type == "Buy") {
            orderOwner.activeBuyOrders = orderOwner.activeBuyOrders.minus(ONE_BI);
        } else {
            orderOwner.activeSellOrders = orderOwner.activeSellOrders.minus(ONE_BI);
        }
        orderOwner.cancelledOrdersCount = orderOwner.cancelledOrdersCount.plus(ONE_BI);
        orderOwner.save();
        
        // Update Active orders stats
        exchange.totalActiveOrdersCount = exchange.totalActiveOrdersCount.minus(ONE_BI);
        if (order.type == "Buy") {
            exchange.totalActiveBuyOrdersCount = exchange.totalActiveBuyOrdersCount.minus(ONE_BI);
        } else {
            exchange.totalActiveSellOrdersCount = exchange.totalActiveSellOrdersCount.minus(ONE_BI);
        }
    }
    exchange.save();
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
        if (order.amountFilled != order.amountClaimed) {          
          let claimOrder = new OrderClaimTransaction(concat(orderId.toHexString(), order.claimOrdersCount.toHexString()));
          claimOrder.order = order.id;
          claimOrder.amountClaimed = order.amountFilled.minus(order.amountClaimed);
          claimOrder.createdAtTimestamp = event.block.timestamp;
          claimOrder.save();

          order.lastClaimedAtTimestamp = event.block.timestamp;
          order.amountClaimed = order.amountFilled;
          order.claimOrdersCount = order.claimOrdersCount.plus(ONE_BI);
        }
        order.save();
    }
}

export function handleClaimedRoyalties(event: ClaimedRoyaltiesEvent): void {
    let tokens = event.params.tokens;
    let amounts = event.params.amounts;

    // If user doesn't exist 
    let account = Account.load(event.params.owner.toHexString());
    if (account == null) {
        account = createAccount(event.params.owner);
    }

    for (let i = 0; i < tokens.length; ++i) {
        let royaltyId = getUserRoyaltyId(tokens[i].toHexString(), account.id);
        let royalty = UserRoyalty.load(royaltyId);
        if (royalty == null) {
            royalty = createUserRoyalty(royaltyId, tokens[i].toHexString(), account.id);
        }
        royalty.claimedAmount = royalty.claimedAmount.plus(amounts[i]);
        royalty.save();
    }
}