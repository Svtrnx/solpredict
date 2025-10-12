import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

export type StepStatus = "pending" | "active" | "success" | "warning" | "error"

interface Step {
  status: StepStatus
  message?: string
}

interface MarketCreationStepperState {
  isOpen: boolean
  currentStep: number
  steps: Step[]
  hasWarnings: boolean
  marketPda?: string
}

const initialState: MarketCreationStepperState = {
  isOpen: false,
  currentStep: 0,
  steps: [{ status: "pending" }, { status: "pending" }],
  hasWarnings: false,
  marketPda: undefined,
}

const marketCreationStepperSlice = createSlice({
  name: "marketCreationStepper",
  initialState,
  reducers: {
    openStepper: (state) => {
      state.isOpen = true
    },
    closeStepper: (state) => {
      state.isOpen = false
    },
    resetStepper: (state) => {
      state.currentStep = 0
      state.steps = [{ status: "pending" }, { status: "pending" }]
      state.hasWarnings = false
      state.marketPda = undefined
    },
    setStepStatus: (state, action: PayloadAction<{ step: number; status: StepStatus; message?: string }>) => {
      const { step, status, message } = action.payload
      if (step >= 0 && step < state.steps.length) {
        state.steps[step].status = status
        state.steps[step].message = message
        if (status === "warning") {
          state.hasWarnings = true
        }
      }
    },
    nextStep: (state) => {
      if (state.currentStep < state.steps.length - 1) {
        state.currentStep += 1
      }
    },
    setMarketPda: (state, action: PayloadAction<string>) => {
      state.marketPda = action.payload
    },
  },
})

export const { openStepper, closeStepper, resetStepper, setStepStatus, nextStep, setMarketPda } =
  marketCreationStepperSlice.actions
export default marketCreationStepperSlice.reducer
