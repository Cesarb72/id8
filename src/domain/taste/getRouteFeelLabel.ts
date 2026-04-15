interface RouteFeelInput {
  estimatedTotalMinutes: number
  averageTransitionFriction: number
  totalRouteFriction: number
  transitionCount: number
}

export function getRouteFeelLabel({
  estimatedTotalMinutes,
  averageTransitionFriction,
  totalRouteFriction,
  transitionCount,
}: RouteFeelInput): string {
  if (averageTransitionFriction <= 1 && estimatedTotalMinutes <= 210) {
    return 'Easy evening nearby'
  }
  if (estimatedTotalMinutes <= 165 && averageTransitionFriction <= 1.6) {
    return 'A compact night out'
  }
  if (estimatedTotalMinutes >= 210 && averageTransitionFriction <= 2) {
    return 'A slightly longer outing with room to wander'
  }
  if (
    averageTransitionFriction >= 2.6 ||
    totalRouteFriction >= 8 ||
    (estimatedTotalMinutes >= 240 && transitionCount >= 3)
  ) {
    return 'A more adventurous route with extra movement'
  }
  if (averageTransitionFriction <= 2.1) {
    return 'A steady outing with a few transitions'
  }
  return 'A longer route with a bit more movement'
}
