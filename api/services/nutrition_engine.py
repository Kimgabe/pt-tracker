"""Nutrition engine: BMR, TDEE, macro calculations for workout-diet integration."""
from dataclasses import dataclass


@dataclass
class NutritionTarget:
    calories: float
    protein_g: float
    carb_g: float
    fat_g: float


def calculate_bmr(weight_kg: float, height_cm: float, age: int, is_male: bool = True) -> float:
    """Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.
    More accurate than Harris-Benedict for modern populations.

    Men:   BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5 (kcal)
    Women: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
    """
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return bmr + 5 if is_male else bmr - 161


ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}


def calculate_tdee(bmr: float, activity_level: str = "moderate") -> float:
    """Calculate Total Daily Energy Expenditure."""
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    return bmr * multiplier


# Goal-based macro ratios (protein%, carb%, fat%)
MACRO_RATIOS = {
    "diet": {"protein": 0.40, "carb": 0.30, "fat": 0.30},
    "maintain": {"protein": 0.30, "carb": 0.40, "fat": 0.30},
    "bulking": {"protein": 0.30, "carb": 0.50, "fat": 0.20},
}

GOAL_CALORIE_ADJUSTMENTS = {
    "diet": -500,      # 500 kcal deficit
    "maintain": 0,
    "bulking": 300,    # 300 kcal surplus
}


def calculate_daily_target(
    weight_kg: float,
    height_cm: float,
    age: int,
    is_male: bool,
    activity_level: str,
    goal: str,
    calories_burned_today: float = 0.0,
) -> NutritionTarget:
    """Calculate daily nutrition target based on user profile and today's activity."""
    bmr = calculate_bmr(weight_kg, height_cm, age, is_male)
    tdee = calculate_tdee(bmr, activity_level)

    # Apply goal adjustment
    goal_adj = GOAL_CALORIE_ADJUSTMENTS.get(goal, 0)
    target_calories = tdee + goal_adj + calories_burned_today

    # Calculate macros
    ratios = MACRO_RATIOS.get(goal, MACRO_RATIOS["maintain"])
    protein_g = (target_calories * ratios["protein"]) / 4  # 4 kcal per gram
    carb_g = (target_calories * ratios["carb"]) / 4
    fat_g = (target_calories * ratios["fat"]) / 9  # 9 kcal per gram

    return NutritionTarget(
        calories=round(target_calories, 1),
        protein_g=round(protein_g, 1),
        carb_g=round(carb_g, 1),
        fat_g=round(fat_g, 1),
    )


def calculate_remaining_nutrition(
    daily_target: NutritionTarget,
    consumed_calories: float = 0.0,
    consumed_protein: float = 0.0,
    consumed_carb: float = 0.0,
    consumed_fat: float = 0.0,
) -> NutritionTarget:
    """Calculate remaining nutrition allowance for the day."""
    return NutritionTarget(
        calories=round(max(0, daily_target.calories - consumed_calories), 1),
        protein_g=round(max(0, daily_target.protein_g - consumed_protein), 1),
        carb_g=round(max(0, daily_target.carb_g - consumed_carb), 1),
        fat_g=round(max(0, daily_target.fat_g - consumed_fat), 1),
    )
