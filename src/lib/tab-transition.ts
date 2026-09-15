export type TabTransitionDirection = "left" | "right";

let pendingDirection: TabTransitionDirection = "right";

export function setTabTransitionDirection(direction: TabTransitionDirection) {
  pendingDirection = direction;
}

export function getTabTransitionDirection() {
  return pendingDirection;
}
