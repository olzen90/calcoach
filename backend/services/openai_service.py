import openai
import json
import base64
from typing import Optional
import os


# Emoji mapping for common foods
FOOD_EMOJIS = {
    # Fruits
    "apple": "🍎", "banana": "🍌", "orange": "🍊", "grape": "🍇", "strawberry": "🍓",
    "watermelon": "🍉", "melon": "🍈", "peach": "🍑", "pear": "🍐", "cherry": "🍒",
    "lemon": "🍋", "mango": "🥭", "pineapple": "🍍", "coconut": "🥥", "kiwi": "🥝",
    "blueberry": "🫐", "avocado": "🥑",
    # Vegetables
    "tomato": "🍅", "carrot": "🥕", "corn": "🌽", "pepper": "🌶️", "cucumber": "🥒",
    "lettuce": "🥬", "broccoli": "🥦", "garlic": "🧄", "onion": "🧅", "potato": "🥔",
    "salad": "🥗", "eggplant": "🍆",
    # Protein
    "egg": "🥚", "eggs": "🍳", "chicken": "🍗", "meat": "🥩", "steak": "🥩",
    "bacon": "🥓", "beef": "🥩", "pork": "🥩", "fish": "🐟", "salmon": "🍣",
    "shrimp": "🦐", "crab": "🦀", "lobster": "🦞",
    # Dairy
    "milk": "🥛", "cheese": "🧀", "butter": "🧈", "yogurt": "🥛",
    # Grains & Bread
    "bread": "🍞", "toast": "🍞", "rice": "🍚", "pasta": "🍝", "noodles": "🍜",
    "spaghetti": "🍝", "cereal": "🥣", "oatmeal": "🥣", "pancake": "🥞", "waffle": "🧇",
    "croissant": "🥐", "bagel": "🥯", "pretzel": "🥨",
    # Fast food & meals
    "pizza": "🍕", "burger": "🍔", "hamburger": "🍔", "hotdog": "🌭", "sandwich": "🥪",
    "taco": "🌮", "burrito": "🌯", "fries": "🍟", "fried chicken": "🍗",
    # Asian food
    "sushi": "🍣", "ramen": "🍜", "dumpling": "🥟", "bento": "🍱",
    # Desserts & sweets
    "cake": "🍰", "pie": "🥧", "cookie": "🍪", "donut": "🍩", "chocolate": "🍫",
    "candy": "🍬", "ice cream": "🍦", "cupcake": "🧁", "honey": "🍯",
    # Drinks
    "coffee": "☕", "tea": "🍵", "juice": "🧃", "beer": "🍺", "wine": "🍷",
    "cocktail": "🍹", "smoothie": "🥤", "soda": "🥤", "water": "💧",
    # Snacks
    "popcorn": "🍿", "nuts": "🥜", "peanut": "🥜",
    # Supplements & bars
    "protein": "💪", "proteinbar": "💪", "protein bar": "💪", "supplement": "💊",
}


def get_food_emoji(food_name: str) -> str:
    """Get an emoji for a food based on its name."""
    if not food_name:
        return "🍽️"
    
    food_lower = food_name.lower()
    
    # Check exact match first
    if food_lower in FOOD_EMOJIS:
        return FOOD_EMOJIS[food_lower]
    
    # Check if any keyword is in the food name
    for keyword, emoji in FOOD_EMOJIS.items():
        if keyword in food_lower:
            return emoji
    
    # Default emoji
    return "🍽️"


async def analyze_food(
    description: str,
    image_path: Optional[str] = None,
    base_prompt: Optional[str] = None,
    calorie_goal: int = 2000,
    protein_goal: int = 150,
    carbs_goal: int = 250,
    fat_goal: int = 65,
    favorites: list = None,
    todays_meals: list = None,
    todays_totals: dict = None
) -> dict:
    """
    Analyze food description and/or image using GPT-5.2 Vision.
    
    Returns a dict with:
    - food_name: str
    - calories: int
    - protein_g: int
    - carbs_g: int
    - fat_g: int
    - confidence: str ("high", "medium", "low")
    - notes: str
    """
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    client = openai.OpenAI(api_key=api_key)
    
    # Core instructions (not editable by user - required for app to function)
    core_instructions = """You are a smart fitness tracker and nutrition coach. Analyze the user's input and determine what they want.

IMPORTANT: Always respond in the SAME LANGUAGE as the user's input. If they write in Danish, all text fields (food_name, notes, breakdown items, answers) should be in Danish. If they write in English, respond in English. Match their language exactly.

FIRST, determine the type of entry. The user might be:
1. Logging a MEAL they ate (e.g., "2 eggs and toast", "had a protein shake", "lunch was a salad")
2. Logging their WEIGHT (e.g., "I weigh 85kg", "weight 185 lbs", "85.5 kg today")
3. Logging a LIFT/exercise they did (e.g., "squatted 100kg x 8", "bench press 60kg for 10 reps")
4. Logging a body MEASUREMENT (e.g., "waist is 90cm", "measured 88cm waist")
5. EDITING an existing meal from today (e.g., "actually that chicken was 400 calories", "the salmon had 50g protein", "change the pasta to 600 calories", "the first meal had more rice")
6. DELETING a meal from today (e.g., "delete the vaffelrør", "remove the coffee", "slet morgenmaden", "I didn't actually eat the pasta", "fjern det sidste måltid")
7. Asking a QUESTION about nutrition, their logged meals, food in general, or asking for analysis (e.g., "where did my sugar come from?", "how many calories in a Big Mac?", "what should I eat to hit my protein goal?", "am I eating too much sodium?", "what foods are high in fiber?")

Always respond with a JSON object. The "entry_type" field determines the structure:

For MEAL entries:
{
  "entry_type": "meal",
  "food_name": string (create a SHORT, clean headline of 2-5 words IN THE SAME LANGUAGE as the user's input - if they write in Danish, respond in Danish; if English, respond in English),
  "time": string or null (if user mentions a specific time like "at 5:30", "kl 14", "around 8am", extract it as "HH:MM" 24-hour format, e.g. "05:30", "14:00", "08:00". If no time mentioned, use null),
  "calories": number (integer, no decimals),
  "protein_g": number (max 1 decimal, e.g. 15 or 15.5),
  "carbs_g": number (max 1 decimal),
  "fat_g": number (max 1 decimal),
  "sugar_g": number (max 1 decimal - IMPORTANT: always estimate this based on the food's typical sugar content),
  "fiber_g": number (max 1 decimal - IMPORTANT: always estimate this based on the food's typical fiber content),
  "sodium_mg": number (integer, no decimals - IMPORTANT: always estimate this based on the food's typical sodium content),
  "vitamin_a_mcg": number (max 1 decimal - micrograms RAE, estimate based on typical content - use 0 only if the food genuinely contains none, e.g. plain water or pure sugar),
  "vitamin_c_mg": number (max 1 decimal - milligrams, estimate based on typical content - use 0 only if the food genuinely contains none),
  "vitamin_d_mcg": number (max 1 decimal - micrograms, estimate based on typical content - use 0 only if the food genuinely contains none),
  "vitamin_b12_mcg": number (max 1 decimal - micrograms, estimate based on typical content - protein foods and dairy always contain B12),
  "iron_mg": number (max 1 decimal - milligrams, estimate based on typical content - meat, legumes and grains always contain iron),
  "calcium_mg": number (max 1 decimal - milligrams, estimate based on typical content - dairy, protein powders and fortified foods always contain calcium),
  "potassium_mg": number (max 1 decimal - milligrams, estimate based on typical content - almost all whole foods and protein powders contain potassium),
  "magnesium_mg": number (max 1 decimal - milligrams, estimate based on typical content - grains, nuts, protein powders and meat always contain magnesium),
  "confidence": "high" | "medium" | "low",
  "emoji": string (single emoji for the food),
  "breakdown": [{"item": string (in same language as user input), "amount": string, "calories": number (integer), "protein_g": number (max 1 decimal), "carbs_g": number (max 1 decimal), "fat_g": number (max 1 decimal), "sugar_g": number (max 1 decimal), "fiber_g": number (max 1 decimal), "sodium_mg": number (integer), "vitamin_a_mcg": number (max 1 decimal), "vitamin_c_mg": number (max 1 decimal), "vitamin_d_mcg": number (max 1 decimal), "vitamin_b12_mcg": number (max 1 decimal), "iron_mg": number (max 1 decimal), "calcium_mg": number (max 1 decimal), "potassium_mg": number (max 1 decimal), "magnesium_mg": number (max 1 decimal)}] (list EACH identified food item separately with ALL its nutritional values - ALWAYS use grams for the amount, never cups or other units),
  "notes": string (in same language as user input)
}

IMPORTANT FOR MEAL BREAKDOWN:
1. Always break down complex meals into individual components. For example, if someone logs "salmon with beans and gravy", create separate breakdown entries for salmon, beans, and gravy.

2. CRITICAL - The breakdown MUST sum to the exact totals:
   - If the user logs a NEW meal (no pre-set values): Estimate each ingredient's macros, then set the totals as the SUM of all ingredients.
   - If the user logs a SAVED FAVORITE (from "User's Saved Foods" below with pre-set values): The totals are FIXED. Distribute these exact totals proportionally across the ingredients so they sum correctly. For example, if a favorite has 370 calories total with 3 ingredients, divide the 370 calories among them based on typical proportions.

3. The sum of all breakdown items MUST EXACTLY EQUAL the main totals (calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg). Double-check your math before responding.

4. CRITICAL - Quantities and portions: When the user specifies a count (e.g. "4 pieces", "4 stykker", "2 bars", "3 squares"), you MUST calculate nutrition for EXACTLY that count. Start from the nutrition of ONE piece/unit, then multiply by the exact number given. Never estimate a different quantity than what the user states. Examples:
   - "4 pieces of Ritter Sport" → find nutrition for 1 piece (1 square ≈ 6g for a 100g bar with 16 squares), multiply by 4
   - "2 slices of bread" → nutrition for 1 slice × 2
   If you are unsure of the exact piece size, state your assumption in the notes field.

For EDIT entries (modifying an existing meal):
{
  "entry_type": "edit",
  "meal_id": number (the ID of the meal to edit from today's meals list),
  "updates": {
    "calories": number (integer, optional),
    "protein_g": number (max 1 decimal, optional),
    "carbs_g": number (max 1 decimal, optional),
    "fat_g": number (max 1 decimal, optional),
    "sugar_g": number (max 1 decimal, optional),
    "fiber_g": number (max 1 decimal, optional),
    "sodium_mg": number (integer, optional),
    "description": string (optional, new name if changing)
  },
  "breakdown": [{"item": string, "amount": string, "calories": number (integer), "protein_g": number (max 1 decimal), "carbs_g": number (max 1 decimal), "fat_g": number (max 1 decimal), "sugar_g": number (max 1 decimal), "fiber_g": number (max 1 decimal), "sodium_mg": number (integer)}] (REQUIRED - always provide the COMPLETE updated breakdown. If the meal has existing breakdown items (shown in CURRENT BREAKDOWN), start from those and update/add/remove items as needed to reflect the change. The breakdown items MUST sum to the updated totals. Always use grams for amounts.),
  "notes": string (explain what was changed and why)
}

CRITICAL FOR EDITS INVOLVING QUANTITY CORRECTIONS: When the user corrects the number of pieces/units (e.g. "it was only 4 pieces", "actually just 2 slices"), you must:
1. Determine the per-piece nutrition from the existing meal total (existing_total ÷ original_count = per_piece)
2. Multiply per-piece nutrition by the NEW count to get the corrected totals
3. Never guess a different quantity — use EXACTLY the number the user states
Example: meal logged as 640 kcal for "ritter sport" (assumed 1 bar = ~16 pieces). User says "only 4 pieces". Per piece = 640/16 = 40 kcal. Corrected = 4 × 40 = 160 kcal.

For DELETE entries (removing one or more meals):
{
  "entry_type": "delete",
  "meal_ids": [number] (list of IDs of the meals to delete from today's meals list - can be one or multiple),
  "notes": string (confirm what was deleted, in the same language as the user's input)
}

For MERGE entries (combining two or more meals into one):
{
  "entry_type": "merge",
  "keep_meal_id": number (the ID of the meal to keep - typically the first or larger one),
  "delete_meal_ids": [number] (IDs of the meals to delete after merging - must NOT include keep_meal_id),
  "updates": {
    "calories": number (integer - sum of all merged meals),
    "protein_g": number (max 1 decimal - sum),
    "carbs_g": number (max 1 decimal - sum),
    "fat_g": number (max 1 decimal - sum),
    "sugar_g": number (max 1 decimal - sum),
    "fiber_g": number (max 1 decimal - sum),
    "sodium_mg": number (integer - sum),
    "description": string (optional - new combined name if appropriate)
  },
  "breakdown": [{"item": string, "amount": string, "calories": number (integer), "protein_g": number (max 1 decimal), "carbs_g": number (max 1 decimal), "fat_g": number (max 1 decimal), "sugar_g": number (max 1 decimal), "fiber_g": number (max 1 decimal), "sodium_mg": number (integer)}] (REQUIRED - combine ALL breakdown items from ALL merged meals into a single list. The combined breakdown MUST sum to the combined totals. Always use grams for amounts.),
  "notes": string (explain what was merged)
}

For WEIGHT entries:
{
  "entry_type": "weight",
  "weight_kg": number (convert to kg if given in lbs),
  "notes": string
}

For LIFT entries:
{
  "entry_type": "lift",
  "exercise_name": string (e.g., "Squat", "Bench Press", "Deadlift"),
  "weight_kg": number,
  "reps": number,
  "notes": string
}

For MEASUREMENT entries:
{
  "entry_type": "measurement",
  "waist_cm": number,
  "notes": string
}

For QUESTION entries (when user asks something instead of logging):
{
  "entry_type": "question",
  "answer": string (your helpful, friendly response to their question IN THE SAME LANGUAGE as the user's question - can be detailed, use line breaks for readability),
  "related_meals": [number] (optional - array of meal IDs from today if the answer references specific meals)
}

Respond with valid JSON only, no other text."""

    # User-customizable prompt for personality/behavior
    default_personality = """You are a helpful and encouraging nutrition coach. When analyzing food, be supportive and give helpful tips in your notes. Be encouraging and supportive!"""
    
    # Build the system prompt: user customization + core instructions
    user_prompt = base_prompt if base_prompt else default_personality
    system_prompt = f"{user_prompt}\n\n{core_instructions}"
    
    # Add daily goals context
    system_prompt += f"\n\n## User's Daily Goals:\n"
    system_prompt += f"- Calories: {calorie_goal} cal\n"
    system_prompt += f"- Protein: {protein_goal}g\n"
    system_prompt += f"- Carbs: {carbs_goal}g\n"
    system_prompt += f"- Fat: {fat_goal}g\n"
    
    # Add today's progress if available
    if todays_totals:
        calories_eaten = todays_totals.get('calories', 0)
        protein_eaten = todays_totals.get('protein_g', 0)
        carbs_eaten = todays_totals.get('carbs_g', 0)
        fat_eaten = todays_totals.get('fat_g', 0)
        
        calories_remaining = calorie_goal - calories_eaten
        protein_remaining = protein_goal - protein_eaten
        
        system_prompt += f"\n## Today's Progress:\n"
        system_prompt += f"- Calories eaten: {calories_eaten} / {calorie_goal} ({calories_remaining} remaining)\n"
        system_prompt += f"- Protein eaten: {protein_eaten}g / {protein_goal}g ({protein_remaining}g remaining)\n"
        system_prompt += f"- Carbs eaten: {carbs_eaten}g / {carbs_goal}g\n"
        system_prompt += f"- Fat eaten: {fat_eaten}g / {fat_goal}g\n"
        
        system_prompt += "\nUse this information to provide motivating, personalized feedback. Celebrate progress toward goals and gently encourage when needed."
    
    # Add user's saved favorites for accurate tracking
    if favorites:
        system_prompt += "\n\n## User's Saved Foods (FIXED VALUES - use these EXACT totals and breakdown when the user mentions these foods):\n"
        system_prompt += "IMPORTANT: When logging one of these saved foods:\n"
        system_prompt += "1. Use the EXACT calories and macro totals shown\n"
        system_prompt += "2. If a breakdown is provided, use that EXACT breakdown with those EXACT items and values - do NOT invent or guess different items\n"
        system_prompt += "3. If no breakdown is provided, create a reasonable breakdown that sums to the totals\n\n"
        for fav in favorites:
            system_prompt += f"- \"{fav['name']}\": {fav['calories']} cal, {fav['protein_g']}g protein, {fav['carbs_g']}g carbs, {fav['fat_g']}g fat, {fav.get('sugar_g', 0)}g sugar, {fav.get('fiber_g', 0)}g fiber, {fav.get('sodium_mg', 0)}mg sodium"
            # Include the saved breakdown if available
            if fav.get('breakdown'):
                system_prompt += f"\n  SAVED BREAKDOWN (use exactly): {json.dumps(fav['breakdown'], ensure_ascii=False)}"
            system_prompt += "\n"
    
    # Add today's meals context for editing
    if todays_meals:
        system_prompt += "\n\n## Today's Logged Meals (user can edit or merge these):\n"
        for meal in todays_meals:
            system_prompt += f"- ID {meal['id']}: \"{meal['description']}\" - {meal['calories']} cal, {meal['protein_g']}g protein, {meal['carbs_g']}g carbs, {meal['fat_g']}g fat, {meal.get('sugar_g', 0)}g sugar, {meal.get('fiber_g', 0)}g fiber, {meal.get('sodium_mg', 0)}mg sodium"
            if meal.get('original_description'):
                system_prompt += f" (originally logged as: \"{meal['original_description']}\")"
            if meal.get('breakdown'):
                system_prompt += f"\n  CURRENT BREAKDOWN: {json.dumps(meal['breakdown'], ensure_ascii=False)}"
            system_prompt += "\n"
        system_prompt += "\nIf the user wants to edit/correct a meal, use entry_type 'edit' with the meal_id from above."
        system_prompt += "\nIf the user wants to combine/merge two or more meals into one, use entry_type 'merge'."
    
    # Build the messages
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    # Build user content
    user_content = []
    
    # Add image if provided
    if image_path:
        is_url = image_path.startswith("http://") or image_path.startswith("https://")
        if is_url:
            # Blob URL — pass directly to OpenAI (no base64 encoding needed)
            user_content.append({
                "type": "image_url",
                "image_url": {"url": image_path, "detail": "high"}
            })
        elif os.path.exists(image_path):
            # Local file — base64 encode
            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            ext = image_path.split(".")[-1].lower()
            media_type = "image/webp" if ext == "webp" else f"image/{ext}"
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{media_type};base64,{image_data}",
                    "detail": "high"
                }
            })
    
    # Add text description
    user_content.append({
        "type": "text",
        "text": f"User input: {description}\n\nAnalyze what the user is logging and respond with the appropriate JSON structure."
    })
    
    messages.append({"role": "user", "content": user_content})
    
    # Helper to safely parse numbers (handles strings, floats, None)
    def safe_number(value, default=0, as_int=False):
        if value is None:
            return default
        try:
            num = float(value)
            return int(round(num)) if as_int else round(num, 1)
        except (ValueError, TypeError):
            return default
    
    # Call the API
    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # Use gpt-4o which supports vision; replace with gpt-5.2 when available
            messages=messages,
            max_tokens=4000,  # Plenty of room for complex meals with many items
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        print(f"[OpenAI] Raw response: {result_text[:500]}...")  # Debug log
        result = json.loads(result_text)
        
        entry_type = result.get("entry_type", "meal")
        
        # Handle different entry types
        if entry_type == "weight":
            return {
                "entry_type": "weight",
                "weight_kg": safe_number(result.get("weight_kg"), 0),
                "notes": result.get("notes", "")
            }
        elif entry_type == "lift":
            return {
                "entry_type": "lift",
                "exercise_name": result.get("exercise_name", ""),
                "weight_kg": safe_number(result.get("weight_kg"), 0),
                "reps": safe_number(result.get("reps"), 0, as_int=True),
                "notes": result.get("notes", "")
            }
        elif entry_type == "measurement":
            return {
                "entry_type": "measurement",
                "waist_cm": safe_number(result.get("waist_cm"), 0),
                "notes": result.get("notes", "")
            }
        elif entry_type == "edit":
            return {
                "entry_type": "edit",
                "meal_id": safe_number(result.get("meal_id"), 0, as_int=True),
                "updates": result.get("updates", {}),
                "breakdown": result.get("breakdown", []),
                "notes": result.get("notes", "")
            }
        elif entry_type == "delete":
            return {
                "entry_type": "delete",
                "meal_ids": [int(i) for i in result.get("meal_ids", [])],
                "notes": result.get("notes", "")
            }
        elif entry_type == "merge":
            return {
                "entry_type": "merge",
                "keep_meal_id": safe_number(result.get("keep_meal_id"), 0, as_int=True),
                "delete_meal_ids": [int(i) for i in result.get("delete_meal_ids", [])],
                "updates": result.get("updates", {}),
                "breakdown": result.get("breakdown", []),
                "notes": result.get("notes", "")
            }
        elif entry_type == "question":
            return {
                "entry_type": "question",
                "answer": result.get("answer", "I'm not sure how to answer that."),
                "related_meals": result.get("related_meals", [])
            }
        else:
            # Default to meal
            emoji = result.get("emoji")
            if not emoji:
                emoji = get_food_emoji(result.get("food_name", description))
            
            # Get breakdown of identified items
            breakdown = result.get("breakdown", [])
            
            return {
                "entry_type": "meal",
                "food_name": result.get("food_name", description),
                "time": result.get("time"),  # Pass through AI-extracted time (HH:MM format or null)
                "calories": safe_number(result.get("calories"), 0, as_int=True),
                "protein_g": safe_number(result.get("protein_g"), 0),
                "carbs_g": safe_number(result.get("carbs_g"), 0),
                "fat_g": safe_number(result.get("fat_g"), 0),
                "sugar_g": safe_number(result.get("sugar_g"), 0),
                "fiber_g": safe_number(result.get("fiber_g"), 0),
                "sodium_mg": safe_number(result.get("sodium_mg"), 0, as_int=True),
                "vitamin_a_mcg": safe_number(result.get("vitamin_a_mcg"), 0),
                "vitamin_c_mg": safe_number(result.get("vitamin_c_mg"), 0),
                "vitamin_d_mcg": safe_number(result.get("vitamin_d_mcg"), 0),
                "vitamin_b12_mcg": safe_number(result.get("vitamin_b12_mcg"), 0),
                "iron_mg": safe_number(result.get("iron_mg"), 0),
                "calcium_mg": safe_number(result.get("calcium_mg"), 0),
                "potassium_mg": safe_number(result.get("potassium_mg"), 0),
                "magnesium_mg": safe_number(result.get("magnesium_mg"), 0),
                "confidence": result.get("confidence", "medium"),
                "emoji": emoji,
                "breakdown": breakdown,
                "notes": result.get("notes", "")
            }
        
    except json.JSONDecodeError as e:
        # If JSON parsing fails, return a fallback
        print(f"[OpenAI] JSON decode error: {e}")
        return {
            "entry_type": "meal",
            "food_name": description,
            "time": None,
            "calories": 0,
            "protein_g": 0,
            "carbs_g": 0,
            "fat_g": 0,
            "sugar_g": 0,
            "fiber_g": 0,
            "sodium_mg": 0,
            "vitamin_a_mcg": 0,
            "vitamin_c_mg": 0,
            "vitamin_d_mcg": 0,
            "vitamin_b12_mcg": 0,
            "iron_mg": 0,
            "calcium_mg": 0,
            "potassium_mg": 0,
            "magnesium_mg": 0,
            "confidence": "low",
            "emoji": "❓",
            "breakdown": [],
            "notes": "Could not parse AI response. Please enter values manually."
        }
    except Exception as e:
        print(f"[OpenAI] Error: {e}")
        raise Exception(f"OpenAI API error: {str(e)}")
