import { lazy } from "react";
export {
  ToyHeader,
  ToyNav,
  ToyCategories,
  ToyStageMode,
  ToyOverview,
} from "./Chrome";
export const ToyGames = lazy(() => import("./games/Games"));
