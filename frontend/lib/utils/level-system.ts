export const getLevelInfo = (points: number) => {
  if (points >= 15000)
    return {
      level: "Singularity",
      color: "from-purple-400 to-pink-600",
      nextLevel: null,
      nextThreshold: null,
      minPoints: "15,000+",
    }
  if (points >= 10000)
    return {
      level: "Oracle",
      color: "from-blue-400 to-purple-600",
      nextLevel: "Singularity",
      nextThreshold: 15000,
      minPoints: "10,000+",
    }
  if (points >= 5000)
    return {
      level: "Prophet",
      color: "from-green-400 to-blue-600",
      nextLevel: "Oracle",
      nextThreshold: 10000,
      minPoints: "5,000+",
    }
  if (points >= 1000)
    return {
      level: "Forecaster",
      color: "from-yellow-400 to-orange-600",
      nextLevel: "Prophet",
      nextThreshold: 5000,
      minPoints: "1,000+",
    }
  return {
    level: "Observer",
    color: "from-gray-400 to-gray-600",
    nextLevel: "Forecaster",
    nextThreshold: 1000,
    minPoints: "0+",
  }
}

export const getXPProgress = (points: number) => {
  const levelInfo = getLevelInfo(points)
  if (!levelInfo.nextThreshold) return { current: points, max: points, percentage: 100 }

  let previousThreshold = 0
  if (levelInfo.nextThreshold === 15000) previousThreshold = 10000
  else if (levelInfo.nextThreshold === 10000) previousThreshold = 5000
  else if (levelInfo.nextThreshold === 5000) previousThreshold = 1000
  else if (levelInfo.nextThreshold === 1000) previousThreshold = 0

  const current = points - previousThreshold
  const max = levelInfo.nextThreshold - previousThreshold
  const percentage = (current / max) * 100

  return { current, max, percentage }
}
