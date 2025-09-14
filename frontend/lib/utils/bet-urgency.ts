export const getBetUrgency = (timeLeft: string) => {
  const timeStr = timeLeft.toLowerCase()

  if (timeStr.includes("hour")) {
    const hours = Number.parseInt(timeStr)
    if (hours <= 24) return "critical"
    if (hours <= 48) return "urgent"
  }

  if (timeStr.includes("day")) {
    const days = Number.parseInt(timeStr)
    if (days <= 1) return "critical"
    if (days <= 2) return "urgent"
  }

  return "normal"
}

export const getUrgencyStyles = (urgency: string) => {
  switch (urgency) {
    case "critical":
    case "urgent":
      return {
        cardClass: "border-2 border-orange-500/50 shadow-md shadow-orange-500/20",
        timeClass: "text-orange-400 font-semibold",
      }
    default:
      return { cardClass: "", timeClass: "text-muted-foreground" }
  }
}
