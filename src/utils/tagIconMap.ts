// src/utils/tagIconMap.ts
import {
  faUserGraduate,
  faCarSide,
  faGift,
  faLaptop,
  faChild,
  faMedal,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

export const tagIconMap: { [key: string]: any } = {
  "初心者歓迎": faUserGraduate,
  "出張可": faCarSide,
  "体験レッスンあり": faGift,
  "オンライン対応": faLaptop,
  "子ども対応": faChild,
  "受験対応": faMedal,
  "室内楽対応": faUsers,
};
