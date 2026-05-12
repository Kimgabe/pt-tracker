"""Pydantic schemas for recipe/diet data."""
from pydantic import BaseModel


class IngredientItem(BaseModel):
    name: str
    amount: str


class NutritionInfo(BaseModel):
    calories: float = 0.0
    protein_g: float = 0.0
    carb_g: float = 0.0
    fat_g: float = 0.0


class RecipeStep(BaseModel):
    description: str
    timestamp_seconds: int | None = None


class Recipe(BaseModel):
    recipe_name: str
    goal_category: str = "maintain"  # "diet" | "bulking" | "maintain"
    ingredients: list[IngredientItem] = []
    steps: list[RecipeStep | str] = []
    nutrition: NutritionInfo = NutritionInfo()
    estimated_cost_krw: int = 0
    creator: str = ""
    source_url: str = ""
    servings: int = 1
    meal_type: str = "lunch"  # "breakfast"|"lunch"|"dinner"|"snack"|"pre_workout"|"post_workout"
    tags: list[str] = []
    cooking_time_min: int = 0
    difficulty: str = "medium"  # "easy"|"medium"|"hard"
