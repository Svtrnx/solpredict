import { createAsyncThunk } from "@reduxjs/toolkit"
import { connectWalletStart, connectWalletSuccess, connectWalletFailure } from "./walletSlice"

export const connectWallet = createAsyncThunk("wallet/connect", async (_, { dispatch }) => {
  dispatch(connectWalletStart())

  try {

    // placeholder wallet data -> demo!
    const mockAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYt AWWM"
    const mockPublicKey = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
    const mockBalance = "127.45"

    dispatch(
      connectWalletSuccess({
        address: mockAddress,
        publicKey: mockPublicKey,
        balance: mockBalance,
      }),
    )

    return { address: mockAddress, publicKey: mockPublicKey, balance: mockBalance }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to connect wallet"
    dispatch(connectWalletFailure(errorMessage))
    throw error
  }
})
