import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"

interface AlertProps {
	variant?: "success" | "danger" | "info" | "warning"
	message: string
}

export function Alert({ variant = "info", message }: AlertProps) {
	const variants = {
	  success: {
		icon: CheckCircle2,
		containerClass: "border-emerald-300 bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800/30",
		iconWrapperClass: "bg-emerald-200 dark:bg-emerald-900/50",
		iconClass: "text-emerald-700 dark:text-emerald-400",
		textClass: "text-emerald-900 dark:text-emerald-200",
	  },
	  danger: {
		icon: AlertCircle,
		containerClass: "border-red-300 bg-red-100 dark:bg-red-950/20 dark:border-red-800/30",
		iconWrapperClass: "bg-red-200 dark:bg-red-900/50",
		iconClass: "text-red-700 dark:text-red-400",
		textClass: "text-red-900 dark:text-red-200",
	  },
	  info: {
		icon: Info,
		containerClass: "border-blue-300 bg-blue-100 dark:bg-blue-950/20 dark:border-blue-800/30",
		iconWrapperClass: "bg-blue-200 dark:bg-blue-900/50",
		iconClass: "text-blue-700 dark:text-blue-400",
		textClass: "text-blue-900 dark:text-blue-200",
	  },
	  warning: {
		icon: AlertTriangle,
		containerClass: "border-yellow-300 bg-yellow-100 dark:bg-yellow-950/20 dark:border-yellow-800/30",
		iconWrapperClass: "bg-yellow-200 dark:bg-yellow-900/50",
		iconClass: "text-yellow-700 dark:text-yellow-400",
		textClass: "text-yellow-900 dark:text-yellow-200",
	  },
	}
  
	const { icon: Icon, containerClass, iconWrapperClass, iconClass, textClass } = variants[variant]
  
	return (
	  <div className="w-full max-w-sm mx-auto">
		<div className={`relative overflow-hidden rounded-lg border shadow-xs p-4 ${containerClass}`}>
		  <div className="flex items-center gap-3">
			<div className={`rounded-full p-1 ${iconWrapperClass}`}>
			  <Icon className={`h-4 w-4 ${iconClass}`} />
			</div>
			<p className={`text-sm font-medium ${textClass}`}>{message}</p>
		  </div>
		</div>
	  </div>
	)
}