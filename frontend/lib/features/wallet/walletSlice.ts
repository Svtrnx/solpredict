import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

export interface WalletState {
  isConnected: boolean
  isAuthorized: boolean
  address: string | null
  balance: number | null
  publicKey: string | null
  isConnecting: boolean
  error: string | null
}

const initialState: WalletState = {
  isConnected: false,
  isAuthorized: false,
  address: null,
  balance: null,
  publicKey: null,
  isConnecting: true,
  error: null,
}

export const walletSlice = createSlice({
  name: "wallet",
  initialState,
  reducers: {
    connectWalletStart: (state) => {
      state.isConnecting = true
      state.error = null
    },
    connectWalletSuccess: (
      state,
      action: PayloadAction<{
        address: string
        publicKey: string
        balance?: number
      }>,
    ) => {
      // state.isConnected = true
      // state.isAuthorized = true
      state.address = action.payload.address
      state.publicKey = action.payload.publicKey
      if (action.payload.balance !== undefined) {
        state.balance = action.payload.balance
      }
      state.isConnecting = false
      state.error = null
    },
    setAuthorized: (state, action: PayloadAction<boolean>) => {
      state.isAuthorized = action.payload
    },
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.isConnecting = action.payload
    },
    connectWalletFailure: (state, action: PayloadAction<string>) => {
      state.isConnecting = false
      state.error = action.payload
    },
    updateBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload
    },
    disconnectWallet: (state) => {
      state.isConnecting = false
      state.isConnected = false
      state.isAuthorized = false
      state.address = null
      state.publicKey = null
      state.balance = null
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    },
  },
})

export const {
  connectWalletStart,
  connectWalletSuccess,
  connectWalletFailure,
  disconnectWallet,
  updateBalance,
  clearError,
  setConnecting,
  setAuthorized
} = walletSlice.actions

export default walletSlice.reducer
