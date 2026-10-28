import type { ComponentProps } from "react";
type ToyChrome = typeof import("./toy/Chrome");
/** Website placeholders keep component types without importing Toy runtime code. */
export function ToyHeader(_props: ComponentProps<ToyChrome["ToyHeader"]>) {
  return null;
}
export function ToyNav(_props: ComponentProps<ToyChrome["ToyNav"]>) {
  return null;
}
export function ToyCategories(
  _props: ComponentProps<ToyChrome["ToyCategories"]>,
) {
  return null;
}
export function ToyStageMode(
  _props: ComponentProps<ToyChrome["ToyStageMode"]>,
) {
  return null;
}
export function ToyOverview(_props: ComponentProps<ToyChrome["ToyOverview"]>) {
  return null;
}
export function ToyGames(_props: { playing: boolean }) {
  return null;
}
