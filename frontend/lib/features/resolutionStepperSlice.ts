import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

export type StepStatus = "pending" | "active" | "success" | "warning" | "error"

export interface StepState {
  status: StepStatus
  message?: string
}

export interface ResolutionStepperState {
  isOpen: boolean
  currentStep: number
  steps: StepState[]
  hasWarnings: boolean
}

const initialState: ResolutionStepperState = {
  isOpen: false,
  currentStep: 0,
  steps: [{ status: "pending" }, { status: "pending" }, { status: "pending" }],
  hasWarnings: false,
}

export const resolutionStepperSlice = createSlice({
  name: "resolutionStepper",
  initialState,
  reducers: {
    openStepper: (state) => {
      state.isOpen = true
      state.currentStep = 0
      state.steps = [{ status: "pending" }, { status: "pending" }, { status: "pending" }]
      state.hasWarnings = false
    },
    closeStepper: (state) => {
      state.isOpen = false
    },
    startStep: (state, action: PayloadAction<number>) => {
      const stepIndex = action.payload
      if (stepIndex >= 0 && stepIndex < state.steps.length) {
        state.currentStep = stepIndex
        state.steps[stepIndex].status = "active"
      }
    },
    completeStep: (
      state,
      action: PayloadAction<{
        stepIndex: number
        status: "success" | "warning" | "error"
        message?: string
      }>,
    ) => {
      const { stepIndex, status, message } = action.payload
      if (stepIndex >= 0 && stepIndex < state.steps.length) {
        state.steps[stepIndex].status = status
        state.steps[stepIndex].message = message

        if (status === "warning") {
          state.hasWarnings = true
        }

        // If error, don't proceed to next step
        if (status === "error") {
          return
        }

        // Move to next step if not the last one
        if (stepIndex < state.steps.length - 1) {
          state.currentStep = stepIndex + 1
          state.steps[stepIndex + 1].status = "active"
        }
      }
    },
    resetStepper: (state) => {
      state.isOpen = false
      state.currentStep = 0
      state.steps = [{ status: "pending" }, { status: "pending" }, { status: "pending" }]
      state.hasWarnings = false
    },
  },
})

export const { openStepper, closeStepper, startStep, completeStep, resetStepper } = resolutionStepperSlice.actions

export default resolutionStepperSlice.reducer
