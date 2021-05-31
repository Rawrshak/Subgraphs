import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"
import {
  ContentManagerRegistry,
  ContentManagerRegistered
} from "../generated/ContentManagerRegistry/ContentManagerRegistry"
import { 
    ContentManagerRegistry as Registry,
    ContentManager,
    SystemRegistry,
    ContentStorage,
    Asset,
    AssetBalance,
    Content,
    Account
 } from "../generated/schema"