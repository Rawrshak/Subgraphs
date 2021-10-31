# Rawrshak Subgraph 
The Rawrshak Subgraph repo contains the Rawrshak Subgraph code for The Graph. The Graph is an indexing protocol for querying networks like Ethereum and IPFS. We will be publishing this subgraph so that others may develop their own front-end applications and access Rawrshak smart contract information for their own games. 

# Quick-start Guide

## Quick Yarn commands
    yarn prepare:contents:local
    yarn prepare:exchange:local
    yarn codegen
    yarn codegen:contents
    yarn build:contents
    yarn create-local:contents
    yarn remove-local:contents
    yarn deploy-local:contents


## To run a Deterministic Local Hardhat node
    1. Open a new powershell/command prompt
    2. cd to Rawrshak smart contract folder
    3. run: "npx hardhat node" or "yarn server"

## IPFS
You'll need to have an ipfs node running. The metadata pinned on IPFS should work, but since it's non-detrministic, it may fail because of timeout. In this case, install a local ipfs node and add the testdata\metadata folder (and pin it).

If necessary, you can upgrade the graph-node version in the docker-compose.yml config file. 
The docker image should be set up for IPFS usage with GRAPH_ALLOW_NON_DETERMINISTIC_IPFS set to 1.

## To set up the local graph node:
    1. open a new terminal/powershell/command prompt and run the deterministic hardhat node
    2. open a new terminal/powershell/command prompt and "yarn docker-up:clean". This deletes any data folders in the docker and starts a docker instance
        - make sure docker is installed
        - delete **docker\data** folder if it exists before running "docker-compose up"
    3. run "yarn install" to get all the packages necessary
    4. After installing the graph-cli (instructions above), make sure you've created an account on [the graph](https://thegraph.com/)
       using your github account
    5. Open a new terminal/powershell and go to the rawrshak contracts folder. run the following:
        "yarn deploy:local"
        "yarn demo:local"
        "yarn "exchange:local"
        Note: make sure the addresses that the smart contracts were deployed to correspond correctly to the addresses in 
        config\local.json files
    6. copy the updated ABIs from build\contracts\ to rawrshak\abis if these smart contracts were updated after 
        compiling
    7. run "yarn prepare:<subgraph>:local" to create the "subgraph.yaml" file 
    8. run "yarn codegen:<subgraph>" where "subgraph" is replaced with the specific subgraph you're building
    9. run "yarn create-local:<subgraph>" after starting docker to create the subgraph (if it hasn't already been created)
        - run 'yarn remove-local' if necessary
    10. run "yarn deploy-local:<subgraph>" to deploy subgraph 
        - the powershell running the ganache and docker service should be doing stuff
        - to redeploy an updated version, just increment the version when running "yarn deploy-local:<subgraph>"
    11. confirm that the ethereum data is being parsed properly
        http://localhost:8000/subgraphs/name/<github_account>/<subgraph>/

## Versions
graph-node: v0.24.2
graph-ts: 0.22.1
graph-cli: 0.22.2


# Subgraphs
## Contents
This subgraph indexes information about the Content contracts, each gaming NFT asset, and user participating on the platform. This organizes data in a queryable manner from front end Dapps and game engines.

## Exchange
This subgraph indexes information about the Rawrshak Marketplace and all the transactions. It aggregates and creates interesting relationships queryable from front end Dapps. Data may also be accessible from game engines.

