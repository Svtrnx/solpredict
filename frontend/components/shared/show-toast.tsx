import { toast } from "sonner"
import { Alert } from "../ui/custom-toast"

export const showToast = (variant: "success" | "danger" | "info" | "warning", message2: string) => {
	const messages = {
		success: message2,
		danger: message2,
		info: message2,
		warning: message2,
	}

	toast.custom(() => <Alert variant={variant} message={messages[variant]} />)
}