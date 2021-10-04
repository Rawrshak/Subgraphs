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
    createOrderFill,
    createUserRoyalty,
    getAssetId,
    getOrderFillId,
    getUserRoyaltyId,
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
    order.type = (event.params.order.isBuyOrder) ? "Buy" : "Sell";
    order.dateCreated = event.block.timestamp;
    order.save();
    
    // Update exchange data
    let exchange = Exchange.load(event.address.toHexString());
    exchange.numOfOrders = exchange.numOfOrders.plus(ONE_BI);
    if (event.params.order.isBuyOrder) {
        exchange.numOfBuyOrders = exchange.numOfBuyOrders.plus(ONE_BI);
    } else {
        exchange.numOfSellOrders = exchange.numOfSellOrders.plus(ONE_BI);
    }
    exchange.save();
}

export function handleBuyOrdersFilled(event: BuyOrdersFilledEvent): void {
    let seller = Account.load(event.params.from.toHexString());
    if (seller == null) {
        seller = createAccount(event.params.from);
    }

    // Check asset and token - must already exist
    let assetId = getAssetId(event.params.asset.contentAddress.toHexString(), event.params.asset.tokenId.toString());
    let asset = Asset.load(assetId);
    let token = Token.load(event.params.token.toHexString());

    // These should be the same lengths, checked by the smart contract
    let orderIds = event.params.orderIds;
    let orderAmounts = event.params.amounts;
    for (let j = 0; j < orderIds.length; ++j) {
        if (orderAmounts[j].equals(ZERO_BI)) {
            continue;
        }

        let orderId = orderIds[j];
        
        // create OrderFill object
        let orderFillId = getOrderFillId(orderId.toHexString(), event.transaction.hash.toHexString());
        let orderFill = createOrderFill(orderFillId, seller.id, orderId.toHexString(), token.id);

        // get order data and update orderFill object
        let exchange = ExchangeContract.bind(event.address);
        let orderData = exchange.getOrder(orderId);
        orderFill.amount = orderAmounts[j];
        orderFill.pricePerItem = orderData.price;
        orderFill.totalPrice = orderAmounts[j].times(orderData.price);
        orderFill.save();

        // Update order status
        let order = Order.load(orderId.toHexString());
        let amountLeft = orderData.amountOrdered.minus(orderData.amountFilled);
        if (amountLeft == ZERO_BI) {
            order.status = "Filled";
            order.dateFilled = event.block.timestamp;
        } else {
            order.status = "PartiallyFilled";
        }
        order.amountFilled = order.amountFilled.plus(orderAmounts[j]);
        order.save();

        // Add user volume to the buy and the seller
        let buyer = Account.load(order.owner);
        buyer.userVolume = buyer.userVolume.plus(orderFill.totalPrice);
        buyer.save();
    }

    seller.userVolume = seller.userVolume.plus(event.params.volume);
    seller.save();

    // Add to asset volume
    asset.assetVolumeTransacted = asset.assetVolumeTransacted.plus(event.params.amountOfAssetsSold);
    asset.save();
    
    // Update volume done using the token
    token.totalVolume = token.totalVolume.plus(event.params.volume);
    token.save();
}

export function handleSellOrdersFilled(event: SellOrdersFilledEvent): void {
    let buyer = Account.load(event.params.from.toHexString());
    if (buyer == null) {
        buyer = createAccount(event.params.from);
    }

    // Check asset and token - must already exist
    let assetId = getAssetId(event.params.asset.contentAddress.toHexString(), event.params.asset.tokenId.toString());
    let asset = Asset.load(assetId);
    let token = Token.load(event.params.token.toHexString());

    // These should be the same lengths, checked by the smart contract
    let orderIds = event.params.orderIds;
    let orderAmounts = event.params.amounts;
    for (let j = 0; j < orderIds.length; ++j) {
        if (orderAmounts[j].equals(ZERO_BI)) {
            continue;
        }

        let orderId = orderIds[j];
        
        // create OrderFill object
        let orderFillId = getOrderFillId(orderId.toHexString(), event.transaction.hash.toHexString());
        let orderFill = createOrderFill(orderFillId, buyer.id, orderId.toHexString(), token.id);

        // get order data and update orderFill object
        let exchange = ExchangeContract.bind(event.address);
        let orderData = exchange.getOrder(orderId);
        orderFill.amount = orderAmounts[j];
        orderFill.pricePerItem = orderData.price;
        orderFill.totalPrice = orderAmounts[j].times(orderData.price);
        orderFill.save();

        // Update order status
        let order = Order.load(orderId.toHexString());
        let amountLeft = orderData.amountOrdered.minus(orderData.amountFilled);
        if (amountLeft == ZERO_BI) {
            order.status = "Filled";
            order.dateFilled = event.block.timestamp;
        } else {
            order.status = "PartiallyFilled";
        }
        order.amountFilled = order.amountFilled.plus(orderAmounts[j]);
        order.save();

        // Add user volume to the buy 
        let seller = Account.load(order.owner);
        seller.userVolume = seller.userVolume.plus(orderFill.totalPrice);
        seller.save();
    }

    // add volume to the seller
    buyer.userVolume = buyer.userVolume.plus(event.params.volume);
    buyer.save();

    // Add to asset volume
    asset.assetVolumeTransacted = asset.assetVolumeTransacted.plus(event.params.amountOfAssetsBought);
    asset.save();

    // Update volume done using the token
    token.totalVolume = token.totalVolume.plus(event.params.volume);
    token.save();
}

export function handleOrdersDeleted(event: OrdersDeletedEvent): void {
    let orderIds = event.params.orderIds;
    for (let j = 0; j < orderIds.length; ++j) {
        let orderId = orderIds[j];

        // Update order status
        let order = Order.load(orderId.toHexString());
        order.status = "Cancelled";
        order.dateCancelled = event.block.timestamp;
        order.save();
    }
}

export function handleOrdersClaimed(event: OrdersClaimedEvent): void {
    let orderIds = event.params.orderIds;
    for (let j = 0; j < orderIds.length; ++j) {
        let orderId = orderIds[j];

        // Update order status
        let order = Order.load(orderId.toHexString());
        
        // Only set to 'Claimed' if the order is fully filled. If it is not, maintain PartiallyFilled 
        // status. All the necessary checks are done on the smart contract so no need to verify incoming
        // data.
        if (order.status == "Filled") {
            order.status = "Claimed";
        }

        // Update dateClaimed every time (even for partially filled orders)
        order.dateClaimed = event.block.timestamp;
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