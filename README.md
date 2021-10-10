# Rawrshak Subgraph 
The Rawrshak Subgraph repo contains the Rawrshak Subgraph code for The Graph. The Graph is an indexing protocol for querying networks like Ethereum and IPFS. We will be publishing this subgraph so that others may develop their own front-end applications and access Rawrshak smart contract information for their own games. 

# Quick-start Guide

## Quick Yarn commands
    yarn codegen
    yarn codegen:contents
    yarn build:contents
    yarn create-local:contents
    yarn remove-local:contents
    yarn deploy-local:contents

## To run a Deterministic Ganache ethereum blockchain
    1. Open a new powershell/command prompt
    2. run:
        ganache-cli -h 0.0.0.0 -m "violin couple forest beyond despair spray wide badge buddy thunder menu same"
        The seed phrase above is a test seed phrase that I use to make the first deployed contract addresses match
        the addresses in the graph node. Addresses need to be updated if you decide to use a different set of seed
        words.
    

## To run a Deterministic Local Hardhat node
    1. Open a new powershell/command prompt
    2. cd to Rawrshak smart contract folder
    3. run: npx hardhat node

## To set up the local graph node:
    1. open a new terminal/powershell/command prompt and run the deterministic Ganache instruction above or hardhat node
    2. open a new terminal/powershell/command prompt and "yarn docker-up:clean". This deletes any data folders in the docker and starts a docker instance
        - make sure docker is installed
        - delete **docker\data** folder if it exists before running "docker-compose up"
    3. After installing the graph-cli (instructions above), make sure you've created an account on [the graph](https://thegraph.com/)
       using your github account
    4. graph init --from-example <github_username>/rawrshak
    5. truffle compile && truffle migrate --reset
        Note: make sure the addresses that the smart contracts were deployed to correspond correctly to the addresses in 
        rawrshak\subgraph.yaml (and rawrshak\src\game.ts).
    6. copy the updated ABIs from build\contracts\ to rawrshak\abis if these smart contracts were updated after 
        compiling
    7. run "yarn install" to download packages
    8. run "yarn codegen:<subgraph>" where "subgraph" is replaced with the specific subgraph you're building
    9. run "yarn create-local:<subgraph>" after starting docker to create the subgraph (if it hasn't already been created)
        - run 'yarn remove-local' if necessary
    10. run "yarn deploy-local:<subgraph>" to deploy subgraph 
        - the powershell running the ganache and docker service should be doing stuff
    11. confirm that the ethereum data is being parsed properly
        http://localhost:8000/subgraphs/name/<github_account>/<subgraph>/

# Subgraphs
## Contents
This subgraph indexes information about the Content contracts, each gaming NFT asset, and user participating on the platform. This organizes data in a queryable manner from front end Dapps and game engines.

## Exchange
This subgraph indexes information about the Rawrshak Marketplace and all the transactions. It aggregates and creates interesting relationships queryable from front end Dapps. Data may also be accessible from game engines.