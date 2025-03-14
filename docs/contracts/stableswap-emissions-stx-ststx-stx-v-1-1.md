## Stableswap Emissions STX-stSTX-STX v1.1

This contract manages the emissions (rewards) for the STX-stSTX Stableswap pool. It handles the distribution of STX rewards to stakers in the pool.

### Key Features

#### Emissions Management

- Cycle-based emissions system
- Configurable reward rates per cycle
- Admin controls for setting and updating rewards
- Multi-cycle rewards claiming

### Core Functions

#### Reward Configuration

- `set-rewards`
  - Sets rewards for a specific cycle
  - Parameters:
    - `cycle`: Cycle number
    - `amount`: Reward amount for the cycle
  - Returns: Response indicating success/failure

- `set-rewards-multi`
  - Sets rewards for multiple cycles at once
  - Parameters:
    - `cycles`: List of cycle numbers
    - `amounts`: List of corresponding reward amounts
  - Returns: Response indicating success/failure

#### Reward Distribution

- `claim-rewards`
  - Claims rewards for a specific cycle
  - Parameters:
    - `cycle`: Cycle to claim rewards from
  - Returns: Response with claimed amount

- `claim-rewards-multi`
  - Claims rewards from multiple cycles at once
  - Parameters:
    - `cycles`: List of cycles to claim from
  - Returns: Response with total claimed amount

#### Administrative Functions

- `set-admin`
  - Updates the contract admin
  - Parameters:
    - `new-admin`: New admin principal
  - Returns: Response indicating success/failure

- `clear-expired-rewards`
  - Cleans up expired rewards data
  - Parameters:
    - `cycle`: Cycle to clear
  - Returns: Response indicating success/failure

#### View Functions

- `get-cycle-rewards`
  - Returns reward information for a cycle
  - Parameters:
    - `cycle`: Cycle number
  - Returns: Response with reward data

- `get-user-rewards`
  - Returns user's claimable rewards
  - Parameters:
    - `user`: User principal
    - `cycle`: Cycle number
  - Returns: Response with reward amount

### Error Codes

- `ERR_UNAUTHORIZED`: Unauthorized operation
- `ERR_INVALID_CYCLE`: Invalid cycle number
- `ERR_NO_REWARDS`: No rewards available
- `ERR_ALREADY_CLAIMED`: Rewards already claimed
- `ERR_TRANSFER_FAILED`: Reward transfer failed

### State Management

- Tracks:
  - Reward amounts per cycle
  - Claimed rewards per user
  - Total rewards distributed
  - Admin configuration

### Usage

This contract works in conjunction with the staking contract to provide rewards to liquidity providers. Admins can configure rewards for different cycles, and users can claim their earned rewards based on their staked positions.
