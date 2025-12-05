// Date estimation service with heuristic fallback and LLM integration

interface EstimateDatesInput {
  name: string;
  category: string;
  purchasedAt: string; // ISO date string
}

interface EstimateDatesOutput {
  estimatedExpirationAt: string;
  estimatedRestockAt: string;
  source: 'heuristic' | 'llm';
}

// Heuristic rules by category and keywords
const HEURISTIC_RULES = {
  'Produce': {
    default: { shelf_life: 5, restock: 7 },
    keywords: {
      // Apples - all varieties 4-6 weeks refrigerated
      'apple': { shelf_life: 35, restock: 21 },
      'ambrosia': { shelf_life: 35, restock: 21 },
      'braeburn': { shelf_life: 35, restock: 21 },
      'cosmic crisp': { shelf_life: 35, restock: 21 },
      'cripps pink': { shelf_life: 35, restock: 21 },
      'envy': { shelf_life: 35, restock: 21 },
      'fuji': { shelf_life: 35, restock: 21 },
      'gala': { shelf_life: 35, restock: 21 },
      'golden delicious': { shelf_life: 35, restock: 21 },
      'granny smith': { shelf_life: 35, restock: 21 },
      'honeycrisp': { shelf_life: 35, restock: 21 },
      'jazz': { shelf_life: 35, restock: 21 },
      'jonagold': { shelf_life: 35, restock: 21 },
      'mcintosh': { shelf_life: 35, restock: 21 },
      'pink lady': { shelf_life: 35, restock: 21 },
      'rome': { shelf_life: 35, restock: 21 },
      
      // Citrus fruits
      'orange': { shelf_life: 14, restock: 10 },
      'navel orange': { shelf_life: 14, restock: 10 },
      'valencia orange': { shelf_life: 14, restock: 10 },
      'blood orange': { shelf_life: 14, restock: 10 },
      'cara cara': { shelf_life: 14, restock: 10 },
      'lemon': { shelf_life: 21, restock: 14 },
      'eureka lemon': { shelf_life: 21, restock: 14 },
      'meyer lemon': { shelf_life: 21, restock: 14 },
      'key lime': { shelf_life: 21, restock: 14 },
      'persian lime': { shelf_life: 21, restock: 14 },
      'lime': { shelf_life: 21, restock: 14 },
      'grapefruit': { shelf_life: 17, restock: 14 },
      'tangerine': { shelf_life: 14, restock: 10 },
      'mandarin': { shelf_life: 10, restock: 7 },
      'clementine': { shelf_life: 10, restock: 7 },
      'minneola': { shelf_life: 14, restock: 10 },
      'pomelo': { shelf_life: 14, restock: 10 },
      
      // Stone fruits
      'peach': { shelf_life: 4, restock: 7 },
      'nectarine': { shelf_life: 4, restock: 7 },
      'apricot': { shelf_life: 4, restock: 7 },
      'plum': { shelf_life: 4, restock: 7 },
      'pluot': { shelf_life: 4, restock: 7 },
      'cherry': { shelf_life: 6, restock: 7 },
      
      // Berries
      'strawberry': { shelf_life: 4, restock: 5 },
      'strawberries': { shelf_life: 4, restock: 5 },
      'blueberry': { shelf_life: 7, restock: 7 },
      'blueberries': { shelf_life: 7, restock: 7 },
      'raspberry': { shelf_life: 2, restock: 5 },
      'raspberries': { shelf_life: 2, restock: 5 },
      'blackberry': { shelf_life: 4, restock: 5 },
      'blackberries': { shelf_life: 4, restock: 5 },
      'boysenberry': { shelf_life: 2, restock: 5 },
      'cranberry': { shelf_life: 5, restock: 7 },
      'cranberries': { shelf_life: 5, restock: 7 },
      
      // Other fruits
      'banana': { shelf_life: 2, restock: 5 },
      'avocado': { shelf_life: 3, restock: 7 },
      'grape': { shelf_life: 6, restock: 7 },
      'grapes': { shelf_life: 6, restock: 7 },
      'cotton candy grapes': { shelf_life: 6, restock: 7 },
      'mango': { shelf_life: 6, restock: 7 },
      'pineapple': { shelf_life: 4, restock: 7 },
      'papaya': { shelf_life: 4, restock: 7 },
      'kiwi': { shelf_life: 5, restock: 7 },
      'cantaloupe': { shelf_life: 7, restock: 7 },
      'honeydew': { shelf_life: 7, restock: 7 },
      'watermelon': { shelf_life: 7, restock: 7 },
      'pomegranate': { shelf_life: 60, restock: 30 },
      'pomegranate arils': { shelf_life: 6, restock: 7 },
      'persimmon': { shelf_life: 5, restock: 7 },
      'fig': { shelf_life: 5, restock: 7 },
      'date': { shelf_life: 5, restock: 7 },
      'coconut': { shelf_life: 5, restock: 7 },
      'lychee': { shelf_life: 5, restock: 7 },
      'dragon fruit': { shelf_life: 5, restock: 7 },
      'guava': { shelf_life: 5, restock: 7 },
      'passion fruit': { shelf_life: 5, restock: 7 },
      'starfruit': { shelf_life: 5, restock: 7 },
      'plantain': { shelf_life: 5, restock: 7 },
      
      // Vegetables - Leafy greens
      'lettuce': { shelf_life: 10, restock: 7 },
      'iceberg': { shelf_life: 10, restock: 7 },
      'romaine': { shelf_life: 10, restock: 7 },
      'butterhead': { shelf_life: 6, restock: 7 },
      'boston': { shelf_life: 6, restock: 7 },
      'bibb': { shelf_life: 6, restock: 7 },
      'spinach': { shelf_life: 5, restock: 7 },
      'arugula': { shelf_life: 4, restock: 5 },
      'kale': { shelf_life: 6, restock: 7 },
      'collard': { shelf_life: 6, restock: 7 },
      'mustard greens': { shelf_life: 6, restock: 7 },
      'swiss chard': { shelf_life: 6, restock: 7 },
      'endive': { shelf_life: 6, restock: 7 },
      'belgian endive': { shelf_life: 5, restock: 7 },
      'radicchio': { shelf_life: 6, restock: 7 },
      'watercress': { shelf_life: 5, restock: 7 },
      'microgreens': { shelf_life: 5, restock: 7 },
      'mixed greens': { shelf_life: 5, restock: 7 },
      'spring mix': { shelf_life: 5, restock: 7 },
      'power greens': { shelf_life: 5, restock: 7 },
      'baby spinach': { shelf_life: 5, restock: 7 },
      
      // Root vegetables
      'carrot': { shelf_life: 17, restock: 14 },
      'baby carrot': { shelf_life: 17, restock: 14 },
      'beet': { shelf_life: 17, restock: 14 },
      'radish': { shelf_life: 10, restock: 7 },
      'daikon': { shelf_life: 6, restock: 7 },
      'turnip': { shelf_life: 17, restock: 14 },
      'rutabaga': { shelf_life: 6, restock: 7 },
      'parsnip': { shelf_life: 17, restock: 14 },
      'jicama': { shelf_life: 6, restock: 7 },
      'celeriac': { shelf_life: 5, restock: 7 },
      
      // Onions and garlic (pantry storage)
      'onion': { shelf_life: 45, restock: 30 },
      'yellow onion': { shelf_life: 45, restock: 30 },
      'red onion': { shelf_life: 45, restock: 30 },
      'white onion': { shelf_life: 45, restock: 30 },
      'sweet onion': { shelf_life: 45, restock: 30 },
      'shallot': { shelf_life: 5, restock: 7 }, // Refrigerated
      'green onion': { shelf_life: 5, restock: 7 },
      'scallion': { shelf_life: 6, restock: 7 },
      'garlic': { shelf_life: 120, restock: 60 }, // Pantry storage
      'ginger': { shelf_life: 25, restock: 21 },
      
      // Potatoes and sweet potatoes (pantry)
      'potato': { shelf_life: 45, restock: 30 },
      'russet': { shelf_life: 45, restock: 30 },
      'sweet potato': { shelf_life: 17, restock: 14 },
      'yam': { shelf_life: 6, restock: 7 },
      
      // Squash and gourds
      'butternut': { shelf_life: 30, restock: 21 },
      'acorn squash': { shelf_life: 30, restock: 21 },
      'winter squash': { shelf_life: 30, restock: 21 },
      'pumpkin': { shelf_life: 30, restock: 21 },
      'zucchini': { shelf_life: 6, restock: 7 },
      'yellow squash': { shelf_life: 6, restock: 7 },
      'cucumber': { shelf_life: 5, restock: 7 },
      'eggplant': { shelf_life: 7, restock: 7 },
      
      // Peppers
      'bell pepper': { shelf_life: 10, restock: 7 },
      'green pepper': { shelf_life: 10, restock: 7 },
      'red pepper': { shelf_life: 6, restock: 7 },
      'yellow pepper': { shelf_life: 6, restock: 7 },
      'orange pepper': { shelf_life: 6, restock: 7 },
      'jalapeño': { shelf_life: 10, restock: 7 },
      'serrano': { shelf_life: 10, restock: 7 },
      'habanero': { shelf_life: 10, restock: 7 },
      'poblano': { shelf_life: 10, restock: 7 },
      'anaheim': { shelf_life: 10, restock: 7 },
      'banana pepper': { shelf_life: 10, restock: 7 },
      'shishito': { shelf_life: 10, restock: 7 },
      
      // Tomatoes
      'tomato': { shelf_life: 4, restock: 7 },
      'roma': { shelf_life: 5, restock: 7 },
      'cherry tomato': { shelf_life: 5, restock: 7 },
      'grape tomato': { shelf_life: 4, restock: 7 },
      'heirloom': { shelf_life: 4, restock: 7 },
      'tomatillo': { shelf_life: 6, restock: 7 },
      
      // Cruciferous vegetables
      'broccoli': { shelf_life: 4, restock: 7 },
      'broccolini': { shelf_life: 5, restock: 7 },
      'cauliflower': { shelf_life: 10, restock: 7 },
      'brussels sprouts': { shelf_life: 4, restock: 7 },
      'cabbage': { shelf_life: 10, restock: 7 },
      'green cabbage': { shelf_life: 10, restock: 7 },
      'red cabbage': { shelf_life: 10, restock: 7 },
      'napa cabbage': { shelf_life: 6, restock: 7 },
      'bok choy': { shelf_life: 6, restock: 7 },
      'baby bok choy': { shelf_life: 5, restock: 7 },
      'rapini': { shelf_life: 5, restock: 7 },
      'kohlrabi': { shelf_life: 6, restock: 7 },
      
      // Other vegetables
      'celery': { shelf_life: 10, restock: 7 },
      'corn': { shelf_life: 1, restock: 5 },
      'corn on the cob': { shelf_life: 1, restock: 5 },
      'asparagus': { shelf_life: 4, restock: 7 },
      'green bean': { shelf_life: 4, restock: 7 },
      'snow pea': { shelf_life: 4, restock: 7 },
      'sugar snap pea': { shelf_life: 4, restock: 7 },
      'artichoke': { shelf_life: 6, restock: 7 },
      'fennel': { shelf_life: 6, restock: 7 },
      'leek': { shelf_life: 6, restock: 7 },
      'okra': { shelf_life: 6, restock: 7 },
      'mushroom': { shelf_life: 4, restock: 7 },
      'button mushroom': { shelf_life: 4, restock: 7 },
      'cremini': { shelf_life: 4, restock: 7 },
      'portobello': { shelf_life: 4, restock: 7 },
      
      // Sprouts
      'alfalfa sprout': { shelf_life: 5, restock: 7 },
      'bean sprout': { shelf_life: 5, restock: 7 },
      
      // Fresh herbs
      'basil': { shelf_life: 4, restock: 7 },
      'cilantro': { shelf_life: 4, restock: 7 },
      'parsley': { shelf_life: 4, restock: 7 },
      'mint': { shelf_life: 4, restock: 7 },
      'dill': { shelf_life: 4, restock: 7 },
      'chives': { shelf_life: 4, restock: 7 },
      'oregano': { shelf_life: 4, restock: 7 },
      'tarragon': { shelf_life: 4, restock: 7 },
      'sage': { shelf_life: 10, restock: 7 },
      'rosemary': { shelf_life: 10, restock: 7 },
      'thyme': { shelf_life: 10, restock: 7 },
      'fennel frond': { shelf_life: 5, restock: 7 },
      'horseradish': { shelf_life: 5, restock: 7 },
    }
  },
  'Dairy': {
    default: { shelf_life: 10, restock: 7 },
    keywords: {
      // Milk and liquid dairy
      'milk': { shelf_life: 6, restock: 7 },
      'whole milk': { shelf_life: 6, restock: 7 },
      'skim milk': { shelf_life: 6, restock: 7 },
      '2% milk': { shelf_life: 6, restock: 7 },
      'lactose-free milk': { shelf_life: 6, restock: 7 },
      'buttermilk': { shelf_life: 6, restock: 7 },
      'half-and-half': { shelf_life: 4, restock: 7 },
      'heavy cream': { shelf_life: 4, restock: 7 },
      'heavy whipping cream': { shelf_life: 4, restock: 7 },
      'light cream': { shelf_life: 4, restock: 7 },
      'whipping cream': { shelf_life: 4, restock: 7 },
      'coffee creamer': { shelf_life: 4, restock: 7 },
      
      // Plant milks
      'almond milk': { shelf_life: 8, restock: 7 },
      'soy milk': { shelf_life: 8, restock: 7 },
      'oat milk': { shelf_life: 8, restock: 7 },
      'coconut milk': { shelf_life: 8, restock: 7 },
      'cashew milk': { shelf_life: 8, restock: 7 },
      
      // Eggs
      'eggs': { shelf_life: 30, restock: 14 },
      'egg': { shelf_life: 30, restock: 14 },
      'egg whites': { shelf_life: 3, restock: 7 },
      'egg yolks': { shelf_life: 3, restock: 7 },
      'egg substitutes': { shelf_life: 3, restock: 7 },
      'hard-cooked eggs': { shelf_life: 7, restock: 7 },
      
      // Butter and spreads
      'butter': { shelf_life: 60, restock: 30 },
      'salted butter': { shelf_life: 60, restock: 30 },
      'unsalted butter': { shelf_life: 60, restock: 30 },
      'ghee': { shelf_life: 60, restock: 30 },
      
      // Fresh cheeses
      'mozzarella': { shelf_life: 23, restock: 14 },
      'fresh mozzarella': { shelf_life: 7, restock: 7 },
      'ricotta': { shelf_life: 7, restock: 7 },
      'cottage cheese': { shelf_life: 7, restock: 7 },
      'cream cheese': { shelf_life: 7, restock: 7 },
      'mascarpone': { shelf_life: 7, restock: 7 },
      'burrata': { shelf_life: 7, restock: 7 },
      'goat cheese': { shelf_life: 7, restock: 7 },
      'chèvre': { shelf_life: 7, restock: 7 },
      'feta': { shelf_life: 7, restock: 7 },
      
      // Semi-hard cheeses
      'cheddar': { shelf_life: 23, restock: 14 },
      'swiss': { shelf_life: 23, restock: 14 },
      'monterey jack': { shelf_life: 23, restock: 14 },
      'colby': { shelf_life: 23, restock: 14 },
      'colby-jack': { shelf_life: 23, restock: 14 },
      'havarti': { shelf_life: 23, restock: 14 },
      'muenster': { shelf_life: 23, restock: 14 },
      'provolone': { shelf_life: 23, restock: 14 },
      'pepper jack': { shelf_life: 23, restock: 14 },
      'gouda': { shelf_life: 23, restock: 14 },
      'fontina': { shelf_life: 23, restock: 14 },
      'emmental': { shelf_life: 23, restock: 14 },
      'jarlsberg': { shelf_life: 23, restock: 14 },
      'manchego': { shelf_life: 23, restock: 14 },
      'halloumi': { shelf_life: 23, restock: 14 },
      'ricotta salata': { shelf_life: 23, restock: 14 },
      
      // Hard cheeses
      'parmesan': { shelf_life: 23, restock: 14 },
      'parmigiano-reggiano': { shelf_life: 23, restock: 14 },
      'pecorino romano': { shelf_life: 23, restock: 14 },
      'grana padano': { shelf_life: 23, restock: 14 },
      'asiago': { shelf_life: 23, restock: 14 },
      
      // Soft-ripened cheeses
      'brie': { shelf_life: 7, restock: 7 },
      'camembert': { shelf_life: 7, restock: 7 },
      'blue cheese': { shelf_life: 7, restock: 7 },
      'taleggio': { shelf_life: 7, restock: 7 },
      
      // Yogurt and fermented
      'yogurt': { shelf_life: 10, restock: 7 },
      'greek yogurt': { shelf_life: 10, restock: 7 },
      'plain yogurt': { shelf_life: 10, restock: 7 },
      'flavored yogurt': { shelf_life: 10, restock: 7 },
      'skyr': { shelf_life: 10, restock: 7 },
      'kefir': { shelf_life: 10, restock: 7 },
    }
  },
  'Meat': {
    default: { shelf_life: 2, restock: 7 },
    keywords: {
      // Ground meats
      'ground beef': { shelf_life: 1, restock: 7 },
      'ground chicken': { shelf_life: 1, restock: 7 },
      'ground turkey': { shelf_life: 1, restock: 7 },
      'ground pork': { shelf_life: 1, restock: 7 },
      'ground lamb': { shelf_life: 1, restock: 7 },
      'ground veal': { shelf_life: 1, restock: 7 },
      
      // Chicken
      'chicken breast': { shelf_life: 1, restock: 7 },
      'chicken thigh': { shelf_life: 1, restock: 7 },
      'chicken drumstick': { shelf_life: 1, restock: 7 },
      'chicken wing': { shelf_life: 1, restock: 7 },
      'chicken tender': { shelf_life: 1, restock: 7 },
      'chicken cutlet': { shelf_life: 1, restock: 7 },
      'chicken leg quarter': { shelf_life: 1, restock: 7 },
      'whole chicken': { shelf_life: 1, restock: 7 },
      'rotisserie chicken': { shelf_life: 3, restock: 7 },
      
      // Turkey
      'turkey breast': { shelf_life: 1, restock: 7 },
      'turkey thigh': { shelf_life: 1, restock: 7 },
      'turkey drumstick': { shelf_life: 1, restock: 7 },
      'turkey wing': { shelf_life: 1, restock: 7 },
      'whole turkey': { shelf_life: 1, restock: 7 },
      
      // Beef cuts
      'beef steak': { shelf_life: 4, restock: 7 },
      'ribeye': { shelf_life: 4, restock: 7 },
      'sirloin': { shelf_life: 4, restock: 7 },
      'strip steak': { shelf_life: 4, restock: 7 },
      'tenderloin': { shelf_life: 4, restock: 7 },
      't-bone': { shelf_life: 4, restock: 7 },
      'porterhouse': { shelf_life: 4, restock: 7 },
      'flank steak': { shelf_life: 4, restock: 7 },
      'skirt steak': { shelf_life: 4, restock: 7 },
      'london broil': { shelf_life: 4, restock: 7 },
      'chuck roast': { shelf_life: 4, restock: 7 },
      'bottom round': { shelf_life: 4, restock: 7 },
      'eye of round': { shelf_life: 4, restock: 7 },
      'top round': { shelf_life: 4, restock: 7 },
      'rib roast': { shelf_life: 4, restock: 7 },
      'brisket': { shelf_life: 4, restock: 7 },
      'tri-tip': { shelf_life: 4, restock: 7 },
      'beef ribs': { shelf_life: 2, restock: 7 },
      'short ribs': { shelf_life: 4, restock: 7 },
      'stew meat': { shelf_life: 4, restock: 7 },
      'beef liver': { shelf_life: 1, restock: 7 },
      'beef tongue': { shelf_life: 1, restock: 7 },
      'beef cheeks': { shelf_life: 1, restock: 7 },
      'oxtail': { shelf_life: 1, restock: 7 },
      
      // Pork
      'pork chop': { shelf_life: 4, restock: 7 },
      'pork tenderloin': { shelf_life: 4, restock: 7 },
      'pork loin': { shelf_life: 4, restock: 7 },
      'pork shoulder': { shelf_life: 4, restock: 7 },
      'pork butt': { shelf_life: 4, restock: 7 },
      'pork sirloin roast': { shelf_life: 4, restock: 7 },
      'baby back ribs': { shelf_life: 4, restock: 7 },
      'spare ribs': { shelf_life: 4, restock: 7 },
      'country-style ribs': { shelf_life: 4, restock: 7 },
      'fresh ham': { shelf_life: 4, restock: 7 },
      'pork cutlet': { shelf_life: 4, restock: 7 },
      'schnitzel': { shelf_life: 4, restock: 7 },
      
      // Lamb
      'lamb chop': { shelf_life: 4, restock: 7 },
      'lamb rack': { shelf_life: 4, restock: 7 },
      'lamb leg': { shelf_life: 4, restock: 7 },
      'lamb shoulder': { shelf_life: 4, restock: 7 },
      'lamb shank': { shelf_life: 4, restock: 7 },
      
      // Fish and seafood
      'salmon': { shelf_life: 1, restock: 5 },
      'tuna': { shelf_life: 1, restock: 5 },
      'cod': { shelf_life: 1, restock: 5 },
      'halibut': { shelf_life: 1, restock: 5 },
      'mahi-mahi': { shelf_life: 1, restock: 5 },
      'snapper': { shelf_life: 1, restock: 5 },
      'flounder': { shelf_life: 1, restock: 5 },
      'sole': { shelf_life: 1, restock: 5 },
      'tilapia': { shelf_life: 1, restock: 5 },
      'catfish': { shelf_life: 1, restock: 5 },
      'trout': { shelf_life: 1, restock: 5 },
      'sea trout': { shelf_life: 1, restock: 5 },
      'arctic char': { shelf_life: 1, restock: 5 },
      'bluefish': { shelf_life: 1, restock: 5 },
      'mackerel': { shelf_life: 1, restock: 5 },
      'sardines': { shelf_life: 1, restock: 5 },
      'anchovies': { shelf_life: 1, restock: 5 },
      'swordfish': { shelf_life: 1, restock: 5 },
      'rockfish': { shelf_life: 1, restock: 5 },
      'ocean perch': { shelf_life: 1, restock: 5 },
      'pollock': { shelf_life: 1, restock: 5 },
      'haddock': { shelf_life: 1, restock: 5 },
      'sablefish': { shelf_life: 1, restock: 5 },
      'black cod': { shelf_life: 1, restock: 5 },
      
      // Shellfish
      'shrimp': { shelf_life: 4, restock: 7 },
      'crab': { shelf_life: 3, restock: 7 },
      'lobster': { shelf_life: 3, restock: 7 },
      'scallops': { shelf_life: 6, restock: 7 },
      'squid': { shelf_life: 2, restock: 7 },
      'calamari': { shelf_life: 2, restock: 7 },
      'crayfish': { shelf_life: 6, restock: 7 },
      'live crab': { shelf_life: 1, restock: 5 },
      'live lobster': { shelf_life: 1, restock: 5 },
      'live clams': { shelf_life: 7, restock: 7 },
      'live mussels': { shelf_life: 7, restock: 7 },
      'live oysters': { shelf_life: 7, restock: 7 },
      'shucked clams': { shelf_life: 6, restock: 7 },
      'shucked mussels': { shelf_life: 6, restock: 7 },
      'shucked oysters': { shelf_life: 6, restock: 7 },
      
      // Processed meats
      'bacon': { shelf_life: 7, restock: 7 },
      'ham': { shelf_life: 4, restock: 7 },
      'honey ham': { shelf_life: 4, restock: 7 },
      'deli ham': { shelf_life: 4, restock: 7 },
      'deli turkey': { shelf_life: 4, restock: 7 },
      'deli roast beef': { shelf_life: 4, restock: 7 },
      'roast beef': { shelf_life: 4, restock: 7 },
      'smoked turkey': { shelf_life: 4, restock: 7 },
      'bologna': { shelf_life: 4, restock: 7 },
      'salami': { shelf_life: 4, restock: 7 },
      'mortadella': { shelf_life: 4, restock: 7 },
      'hot dogs': { shelf_life: 7, restock: 7 },
      
      // Fresh sausages
      'fresh sausage': { shelf_life: 2, restock: 7 },
      'italian sausage': { shelf_life: 2, restock: 7 },
      'bratwurst': { shelf_life: 2, restock: 7 },
      'chorizo': { shelf_life: 2, restock: 7 },
      
      // Cooked leftovers
      'cooked chicken': { shelf_life: 3, restock: 7 },
      'cooked beef': { shelf_life: 3, restock: 7 },
      'cooked pork': { shelf_life: 3, restock: 7 },
      'cooked fish': { shelf_life: 3, restock: 7 },
      
      // Salads
      'chicken salad': { shelf_life: 3, restock: 7 },
      'tuna salad': { shelf_life: 3, restock: 7 },
      'egg salad': { shelf_life: 3, restock: 7 },
      
      // Frozen designation
      'frozen': { shelf_life: 120, restock: 30 },
    }
  },
  'Pantry': {
    default: { shelf_life: 180, restock: 60 },
    keywords: {
      // Bread and baked goods
      'bread': { shelf_life: 4, restock: 7 },
      'sandwich bread': { shelf_life: 4, restock: 7 },
      'white bread': { shelf_life: 4, restock: 7 },
      'whole wheat bread': { shelf_life: 4, restock: 7 },
      'whole grain bread': { shelf_life: 4, restock: 7 },
      'multigrain bread': { shelf_life: 4, restock: 7 },
      'sourdough': { shelf_life: 4, restock: 7 },
      'rye bread': { shelf_life: 4, restock: 7 },
      'pumpernickel': { shelf_life: 4, restock: 7 },
      'gluten-free bread': { shelf_life: 4, restock: 7 },
      'artisan bread': { shelf_life: 4, restock: 7 },
      'crusty loaf': { shelf_life: 4, restock: 7 },
      'brioche': { shelf_life: 4, restock: 7 },
      'bagel': { shelf_life: 4, restock: 7 },
      'english muffin': { shelf_life: 4, restock: 7 },
      'croissant': { shelf_life: 1, restock: 5 },
      'danish pastry': { shelf_life: 1, restock: 5 },
      'muffin': { shelf_life: 1, restock: 5 },
      'naan': { shelf_life: 4, restock: 7 },
      'pita bread': { shelf_life: 4, restock: 7 },
      'tortilla': { shelf_life: 4, restock: 7 },
      'corn tortilla': { shelf_life: 4, restock: 7 },
      'flour tortilla': { shelf_life: 4, restock: 7 },
      
      // Grains and rice
      'rice': { shelf_life: 270, restock: 90 },
      'white rice': { shelf_life: 270, restock: 90 },
      'brown rice': { shelf_life: 270, restock: 90 },
      'basmati rice': { shelf_life: 270, restock: 90 },
      'jasmine rice': { shelf_life: 270, restock: 90 },
      'quinoa': { shelf_life: 270, restock: 90 },
      'oats': { shelf_life: 270, restock: 90 },
      'rolled oats': { shelf_life: 270, restock: 90 },
      'steel-cut oats': { shelf_life: 270, restock: 90 },
      'instant oats': { shelf_life: 270, restock: 90 },
      'couscous': { shelf_life: 270, restock: 90 },
      'polenta': { shelf_life: 270, restock: 90 },
      'cornmeal': { shelf_life: 270, restock: 90 },
      
      // Pasta
      'pasta': { shelf_life: 270, restock: 90 },
      'spaghetti': { shelf_life: 270, restock: 90 },
      'penne': { shelf_life: 270, restock: 90 },
      'macaroni': { shelf_life: 270, restock: 90 },
      'rotini': { shelf_life: 270, restock: 90 },
      'cooked pasta': { shelf_life: 3, restock: 7 },
      'cooked rice': { shelf_life: 3, restock: 7 },
      
      // Flour and baking
      'flour': { shelf_life: 270, restock: 90 },
      'all-purpose flour': { shelf_life: 270, restock: 90 },
      'whole wheat flour': { shelf_life: 270, restock: 90 },
      'baking powder': { shelf_life: 270, restock: 90 },
      'baking soda': { shelf_life: 270, restock: 90 },
      'yeast': { shelf_life: 270, restock: 90 },
      'sugar': { shelf_life: 270, restock: 90 },
      'granulated sugar': { shelf_life: 270, restock: 90 },
      'brown sugar': { shelf_life: 270, restock: 90 },
      'powdered sugar': { shelf_life: 270, restock: 90 },
      
      // Canned goods - Low acid (2-5 years)
      'canned': { shelf_life: 1095, restock: 90 },
      'canned chicken': { shelf_life: 1095, restock: 90 },
      'canned corn': { shelf_life: 1095, restock: 90 },
      'canned green beans': { shelf_life: 1095, restock: 90 },
      'canned soup': { shelf_life: 1095, restock: 90 },
      'chicken noodle soup': { shelf_life: 1095, restock: 90 },
      'chickpeas': { shelf_life: 1095, restock: 90 },
      'garbanzo beans': { shelf_life: 1095, restock: 90 },
      'black beans': { shelf_life: 1095, restock: 90 },
      'pinto beans': { shelf_life: 1095, restock: 90 },
      'kidney beans': { shelf_life: 1095, restock: 90 },
      'peas': { shelf_life: 1095, restock: 90 },
      'tuna': { shelf_life: 1095, restock: 90 },
      'chicken broth': { shelf_life: 1095, restock: 90 },
      
      // Canned goods - High acid (12-18 months)
      'canned tomatoes': { shelf_life: 455, restock: 60 },
      'tomato sauce': { shelf_life: 455, restock: 60 },
      'diced tomatoes': { shelf_life: 455, restock: 60 },
      'canned peaches': { shelf_life: 455, restock: 60 },
      'canned pears': { shelf_life: 455, restock: 60 },
      'canned pineapple': { shelf_life: 455, restock: 60 },
      'pumpkin puree': { shelf_life: 455, restock: 60 },
      
      // Dry legumes
      'dry beans': { shelf_life: 730, restock: 180 },
      'lentils': { shelf_life: 730, restock: 180 },
      'split peas': { shelf_life: 730, restock: 180 },
      
      // Nuts and seeds
      'nuts': { shelf_life: 180, restock: 60 },
      'almonds': { shelf_life: 180, restock: 60 },
      'cashews': { shelf_life: 180, restock: 60 },
      'peanuts': { shelf_life: 180, restock: 60 },
      'pecans': { shelf_life: 180, restock: 60 },
      'pistachios': { shelf_life: 180, restock: 60 },
      'walnuts': { shelf_life: 180, restock: 60 },
      'pumpkin seeds': { shelf_life: 180, restock: 60 },
      'pepitas': { shelf_life: 180, restock: 60 },
      'sunflower seeds': { shelf_life: 180, restock: 60 },
      
      // Nut butters
      'peanut butter': { shelf_life: 75, restock: 30 },
      'almond butter': { shelf_life: 75, restock: 30 },
      'tahini': { shelf_life: 75, restock: 30 },
      
      // Oils and vinegars
      'oil': { shelf_life: 180, restock: 90 },
      'olive oil': { shelf_life: 180, restock: 90 },
      'vegetable oil': { shelf_life: 180, restock: 90 },
      'sesame oil': { shelf_life: 180, restock: 90 },
      'vinegar': { shelf_life: 1095, restock: 365 }, // Keeps indefinitely
      
      // Condiments and sauces
      'honey': { shelf_life: 1095, restock: 365 }, // Keeps indefinitely
      'jam': { shelf_life: 180, restock: 90 },
      'jelly': { shelf_life: 180, restock: 90 },
      'ketchup': { shelf_life: 120, restock: 60 },
      'mustard': { shelf_life: 120, restock: 60 },
      'mayonnaise': { shelf_life: 120, restock: 60 },
      'bbq sauce': { shelf_life: 120, restock: 60 },
      'hot sauce': { shelf_life: 120, restock: 60 },
      'soy sauce': { shelf_life: 120, restock: 60 },
      'worcestershire': { shelf_life: 120, restock: 60 },
      'salsa': { shelf_life: 120, restock: 60 },
      'salad dressing': { shelf_life: 120, restock: 60 },
      'vinaigrette': { shelf_life: 120, restock: 60 },
      
      // Coffee and tea
      'coffee': { shelf_life: 150, restock: 60 },
      'ground coffee': { shelf_life: 45, restock: 30 },
      'tea': { shelf_life: 540, restock: 180 },
      'leaf tea': { shelf_life: 540, restock: 180 },
      'cold brew': { shelf_life: 8, restock: 7 },
      'iced tea': { shelf_life: 4, restock: 7 },
      
      // Breakfast cereals and granola
      'cereal': { shelf_life: 270, restock: 60 },
      'breakfast cereal': { shelf_life: 270, restock: 60 },
      'corn flakes': { shelf_life: 270, restock: 60 },
      'bran flakes': { shelf_life: 270, restock: 60 },
      'cheerios': { shelf_life: 270, restock: 60 },
      'oat squares': { shelf_life: 270, restock: 60 },
      'rice cereal': { shelf_life: 270, restock: 60 },
      'granola': { shelf_life: 270, restock: 60 },
      'muesli': { shelf_life: 270, restock: 60 },
      
      // Snacks
      'crackers': { shelf_life: 270, restock: 60 },
      'cookies': { shelf_life: 270, restock: 60 },
      'potato chips': { shelf_life: 150, restock: 60 },
      'pretzels': { shelf_life: 150, restock: 60 },
      'popcorn': { shelf_life: 270, restock: 60 },
      'trail mix': { shelf_life: 150, restock: 60 },
      'protein bars': { shelf_life: 150, restock: 60 },
      'tortilla chips': { shelf_life: 150, restock: 60 },
      
      // Macaroni salad and deli items (refrigerated)
      'macaroni salad': { shelf_life: 3, restock: 7 },
      'soups': { shelf_life: 3, restock: 7 },
      'stews': { shelf_life: 3, restock: 7 },
    }
  },
  'Frozen': {
    default: { shelf_life: 120, restock: 30 },
    keywords: {
      // Frozen fruits and vegetables
      'frozen fruit': { shelf_life: 150, restock: 60 },
      'frozen vegetables': { shelf_life: 150, restock: 60 },
      'frozen berries': { shelf_life: 150, restock: 60 },
      
      // Frozen meals and proteins
      'ice cream': { shelf_life: 120, restock: 30 },
      'frozen pizza': { shelf_life: 120, restock: 30 },
      'frozen chicken nuggets': { shelf_life: 150, restock: 60 },
      'frozen fish fillets': { shelf_life: 150, restock: 60 },
      'frozen shrimp': { shelf_life: 150, restock: 60 },
      
      // General frozen designation
      'frozen': { shelf_life: 120, restock: 30 },
    }
  },
  'Beverages': {
    default: { shelf_life: 90, restock: 30 },
    keywords: {
      // Fresh juices (refrigerated, opened)
      'juice': { shelf_life: 8, restock: 7 },
      'apple juice': { shelf_life: 8, restock: 7 },
      'orange juice': { shelf_life: 8, restock: 7 },
      
      // Plant milks (already covered in Dairy but repeated here)
      'almond milk': { shelf_life: 8, restock: 7 },
      'soy milk': { shelf_life: 8, restock: 7 },
      'oat milk': { shelf_life: 8, restock: 7 },
      'coconut milk': { shelf_life: 8, restock: 7 },
      'cashew milk': { shelf_life: 8, restock: 7 },
      
      // Sodas and carbonated beverages
      'soda': { shelf_life: 90, restock: 30 },
      'open soda': { shelf_life: 8, restock: 7 }, // Refrigerated after opening
      
      // Water
      'water': { shelf_life: 365, restock: 60 },
      
      // Coffee and tea beverages
      'coffee': { shelf_life: 150, restock: 60 },
      'tea': { shelf_life: 540, restock: 180 },
      'cold brew coffee': { shelf_life: 8, restock: 7 },
      'iced tea': { shelf_life: 4, restock: 7 },
    }
  },
  'Household': {
    default: { shelf_life: 365, restock: 90 },
    keywords: {
      'paper': { shelf_life: 365, restock: 60 },
      'detergent': { shelf_life: 365, restock: 90 },
      'soap': { shelf_life: 365, restock: 60 },
    }
  },
  'Personal Care': {
    default: { shelf_life: 365, restock: 90 },
    keywords: {
      'toothpaste': { shelf_life: 730, restock: 90 },
      'shampoo': { shelf_life: 365, restock: 90 },
      'deodorant': { shelf_life: 365, restock: 90 },
    }
  },
  'Baby': {
    default: { shelf_life: 30, restock: 14 },
    keywords: {
      'formula': { shelf_life: 30, restock: 14 },
      'diapers': { shelf_life: 365, restock: 30 },
      'food': { shelf_life: 14, restock: 14 },
    }
  },
  'Pet': {
    default: { shelf_life: 90, restock: 30 },
    keywords: {
      'food': { shelf_life: 90, restock: 30 },
      'treats': { shelf_life: 180, restock: 60 },
      'litter': { shelf_life: 365, restock: 30 },
    }
  }
};

function getHeuristicEstimate(name: string, category: string): { shelf_life: number; restock: number } {
  const categoryRules = HEURISTIC_RULES[category as keyof typeof HEURISTIC_RULES];
  if (!categoryRules) {
    return { shelf_life: 30, restock: 30 }; // Default fallback
  }

  const nameLower = name.toLowerCase();
  
  // Check for keyword matches
  for (const [keyword, rule] of Object.entries(categoryRules.keywords || {})) {
    if (nameLower.includes(keyword)) {
      return rule;
    }
  }
  
  return categoryRules.default;
}

async function getLLMEstimate(input: EstimateDatesInput): Promise<{ shelf_life: number; restock: number } | null> {
  try {
    const functionUrl = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/estimate-dates";
    if (!functionUrl) {
      throw new Error('VITE_SUPABASE_URL environment variable not set');
    }

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('LLM estimation failed');
    }

    const data = await response.json();
    return {
      shelf_life: data.shelfLifeDays,
      restock: data.restockDays,
    };
  } catch (error) {
    console.warn('LLM estimation failed, falling back to heuristics:', error);
    return null;
  }
}

export async function estimateDates(input: EstimateDatesInput): Promise<EstimateDatesOutput> {
  const purchaseDate = new Date(input.purchasedAt);
  
  // Try LLM first, fall back to heuristics
  let estimate = await getLLMEstimate(input);
  let source: 'heuristic' | 'llm' = 'llm';
  
  if (!estimate) {
    estimate = getHeuristicEstimate(input.name, input.category);
    source = 'heuristic';
  }

  // Calculate dates
  const expirationDate = new Date(purchaseDate);
  expirationDate.setDate(expirationDate.getDate() + estimate.shelf_life);

  const restockDate = new Date(purchaseDate);
  restockDate.setDate(restockDate.getDate() + estimate.restock);

  // Cap expiration within 365 days
  const maxExpirationDate = new Date(purchaseDate);
  maxExpirationDate.setDate(maxExpirationDate.getDate() + 365);
  
  if (expirationDate > maxExpirationDate) {
    expirationDate.setTime(maxExpirationDate.getTime());
  }

  return {
    estimatedExpirationAt: expirationDate.toISOString().split('T')[0],
    estimatedRestockAt: Math.min(expirationDate.getTime(), restockDate.getTime()) === restockDate.getTime() 
      ? restockDate.toISOString().split('T')[0]
      : expirationDate.toISOString().split('T')[0],
    source,
  };
}