import { getHouseDoors } from "@/lib/house-doors";
import { CategoryGridClient } from "./CategoryGridClient";

export async function CategoryGrid() {
  const cards = await getHouseDoors();
  return <CategoryGridClient cards={cards} />;
}
