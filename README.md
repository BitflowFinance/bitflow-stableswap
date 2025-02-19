# Bitflow Stableswap Protocol

## Contract Documentation

| Contract | Description | Documentation |
|----------|-------------|---------------|
| `stableswap-core-v-1-1` | Core protocol contract managing pools and swaps | [Documentation](docs/contracts/stableswap-core-v-1-1.md) |
| `stableswap-pool-stx-ststx-v-1-1` | STX-stSTX pool implementation | [Documentation](docs/contracts/stableswap-pool-stx-ststx-v-1-1.md) |
| `stableswap-pool-trait-v-1-1` | Pool interface trait | [Documentation](docs/contracts/stableswap-pool-trait-v-1-1.md) |
| `sip-010-trait-ft-standard-v-1-1` | Fungible token standard trait | [Documentation](docs/contracts/sip-010-trait-ft-standard-v-1-1.md) |
| `token-stx-v-1-1` | STX token implementation | [Documentation](docs/contracts/token-stx-v-1-1.md) |
| `stableswap-staking-stx-ststx-v-1-1` | Staking contract for LP tokens | [Documentation](docs/contracts/stableswap-staking-stx-ststx-v-1-1.md) |
| `stableswap-emissions-stx-ststx-stx-v-1-1` | Emissions contract for staking rewards | [Documentation](docs/contracts/stableswap-emissions-stx-ststx-stx-v-1-1.md) |

A decentralized exchange protocol implementing the Stableswap invariant for efficient stable asset trading on the Stacks blockchain.

## Overview

The Bitflow Stableswap protocol provides a specialized Automated Market Maker (AMM) designed for trading pairs of tokens that are expected to have similar values. It uses a hybrid constant product/constant sum formula that provides better liquidity and lower slippage for stable pairs compared to traditional constant product AMMs.

### Key Features

- Optimized for stable pairs trading
- Low slippage for similarly-priced assets
- Configurable amplification coefficient
- Flexible fee structure
- Emergency controls and safety features
- Staking and rewards system

## Quick Start

### Prerequisites

- [Clarinet](https://docs.hiro.so/clarinet/installing-clarinet) for local development
- [Node.js](https://nodejs.org/) (v14 or higher)
- [Git](https://git-scm.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/BitflowFinance/bitflow-stableswap.git
   cd bitflow-stableswap
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run tests:
   ```bash
   clarinet test
   ```

## Contract Architecture

The protocol consists of several interconnected smart contracts:

### Core Contracts

1. **stableswap-core-v-1-1**
   - Central contract managing pools and swaps
   - Handles pool creation and configuration
   - Implements core swap logic
   - Manages protocol fees and admin functions

2. **stableswap-pool-stx-ststx-v-1-1**
   - Implementation of STX-stSTX pool
   - Manages pool state and balances
   - Handles liquidity operations
   - Implements pool-specific logic

### Supporting Contracts

1. **stableswap-pool-trait-v-1-1**
   - Defines interface for pool implementations
   - Standardizes pool functionality
   - Ensures consistent pool behavior

2. **sip-010-trait-ft-standard-v-1-1**
   - SIP-010 fungible token standard
   - Required for token compatibility
   - Ensures consistent token behavior

## Usage Guide

### Creating a Pool

```clarity
(contract-call? .stableswap-core-v-1-1 create-pool
    .stableswap-pool-stx-ststx-v-1-1  ;; pool contract
    .token-stx-v-1-1                   ;; token X
    .token-ststx                       ;; token Y
    u1000000                           ;; initial X amount
    u1000000                           ;; initial Y amount
    u30                                ;; X protocol fee (0.3%)
    u30                                ;; X provider fee (0.3%)
    u30                                ;; Y protocol fee (0.3%)
    u30                                ;; Y provider fee (0.3%)
    u30                                ;; liquidity fee (0.3%)
    u100                               ;; amplification coefficient
    tx-sender                          ;; fee collector
    u""                                ;; pool URI
    true                               ;; pool status
)
```

### Adding Liquidity

```clarity
;; Approve token transfers first
(contract-call? .token-stx-v-1-1 approve .stableswap-pool-stx-ststx-v-1-1 u1000000)
(contract-call? .token-ststx approve .stableswap-pool-stx-ststx-v-1-1 u1000000)

;; Add liquidity
(contract-call? .stableswap-core-v-1-1 add-liquidity
    .stableswap-pool-stx-ststx-v-1-1  ;; pool contract
    .token-stx-v-1-1                   ;; token X
    .token-ststx                       ;; token Y
    u1000000                           ;; X amount
    u1000000                           ;; Y amount
    u1000                              ;; minimum LP tokens
)
```

### Performing Swaps

```clarity
;; Swap STX for stSTX
(contract-call? .stableswap-core-v-1-1 swap-x-for-y
    .stableswap-pool-stx-ststx-v-1-1  ;; pool contract
    .token-stx-v-1-1                   ;; token X
    .token-ststx                       ;; token Y
    u100000                            ;; X amount
    u99000                             ;; minimum Y to receive
)

;; Swap stSTX for STX
(contract-call? .stableswap-core-v-1-1 swap-y-for-x
    .stableswap-pool-stx-ststx-v-1-1  ;; pool contract
    .token-stx-v-1-1                   ;; token X
    .token-ststx                       ;; token Y
    u100000                            ;; Y amount
    u99000                             ;; minimum X to receive
)
```

### Removing Liquidity

```clarity
(contract-call? .stableswap-core-v-1-1 withdraw-liquidity
    .stableswap-pool-stx-ststx-v-1-1  ;; pool contract
    .token-stx-v-1-1                   ;; token X
    .token-ststx                       ;; token Y
    u1000000                           ;; LP tokens to burn
    u990000                            ;; minimum X to receive
    u990000                            ;; minimum Y to receive
)
```

## Configuration

### Pool Parameters

- **Amplification Coefficient**: Controls the pool's price curve. Higher values create a more stable price around the 1:1 ratio.
- **Fees**: Configurable protocol, provider, and liquidity fees in basis points (1 bp = 0.01%).
- **Convergence Threshold**: Controls price calculation precision.

### Administrative Functions

- Pool creation control
- Fee parameter management
- Emergency controls
- Admin list management

## Security

### Safety Features

1. **Access Control**
   - Admin-only functions
   - Multi-admin support
   - Protected fee settings

2. **Trading Protections**
   - Slippage protection
   - Maximum swap limits
   - Balance validations

3. **Emergency Controls**
   - Pool pause functionality
   - Emergency admin system
   - Fee collector management

## Development

### Testing

Run the test suite:
```bash
clarinet test
```

Run specific tests:
```bash
clarinet test tests/stableswap-pool-stx-ststx-v-1-1.test.ts
```

### Deployment

1. Configure deployment settings in `Clarinet.toml`
2. Deploy using Clarinet:
   ```bash
   clarinet deploy
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Create a pull request

## License

[MIT License](LICENSE)

## Documentation

For detailed documentation of each contract, see the `/docs` directory:

- [Core Contract Documentation](docs/contracts/stableswap-core-v-1-1.md)
- [Pool Contract Documentation](docs/contracts/stableswap-pool-stx-ststx-v-1-1.md)
- [Pool Trait Documentation](docs/contracts/stableswap-pool-trait-v-1-1.md)