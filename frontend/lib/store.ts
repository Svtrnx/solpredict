import resolutionStepperReducer from "./features/resolutionStepperSlice"
import walletReducer from "./features/wallet/walletSlice"
import { configureStore } from "@reduxjs/toolkit"

export const store = configureStore({
  reducer: {
    wallet: walletReducer,
    resolutionStepper: resolutionStepperReducer
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
