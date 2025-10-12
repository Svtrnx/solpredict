import marketCreationStepperReducer from "./features/marketCreationStepperSlice"
import resolutionStepperReducer from "./features/resolutionStepperSlice"
import walletReducer from "./features/wallet/walletSlice"
import { configureStore } from "@reduxjs/toolkit"

export const store = configureStore({
  reducer: {
    marketCreationStepper: marketCreationStepperReducer,
    resolutionStepper: resolutionStepperReducer,
    wallet: walletReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
