// City Name Generator
// Improved lists focused on real town-name patterns.
// Nouns: geographic features, trees/plants, animals, settlement terms, and common surnames/personal names.
// Adjectives: physical and locative descriptors that fit place names.
// Patterns favor adjective + noun and name + suffix combinations.

const nouns = [
  // Geographic features and landforms (~90)
  "River", "Creek", "Brook", "Lake", "Pond", "Spring", "Falls", "Bay", "Point", "Beach",
  "Island", "Rock", "Stone", "Cliff", "Bluff", "Mesa", "Butte", "Plateau", "Canyon", "Gulch",
  "Hollow", "Glen", "Meadow", "Prairie", "Plain", "Forest", "Grove", "Wood", "Ridge", "Peak",
  "Valley", "Hill", "Mountain", "Pass", "Gap", "Fork", "Bend", "Corner", "Delta", "Inlet",
  "Sound", "Strait", "Cape", "Head", "Marsh", "Swamp", "Desert", "Oasis", "Basin", "Cove",
  "Harbor", "Port", "Dock", "Pier", "Wharf", "Shore", "Strand", "Bar", "Spit", "Reef",
  "Dune", "Mound", "Knob", "Spur", "Slope", "Bench", "Terrace", "Flats", "Bottom", "Bottoms",
  "Forks", "Branches", "Run", "Branch", "Kill", "Slough", "Bayou", "Wash", "Arroyo", "Draw",
  "Gully", "Ravine", "Gorge", "Notch", "Saddle", "Col", "Cirque", "Basin", "Sink", "Pit",

  // Trees, plants, and natural materials (~70)
  "Oak", "Pine", "Maple", "Cedar", "Elm", "Willow", "Ash", "Birch", "Spruce", "Fir",
  "Cypress", "Redwood", "Sequoia", "Poplar", "Aspen", "Hickory", "Walnut", "Chestnut", "Alder", "Beech",
  "Sycamore", "Magnolia", "Dogwood", "Holly", "Ivy", "Moss", "Fern", "Reed", "Cane", "Palm",
  "Iron", "Copper", "Gold", "Silver", "Steel", "Bronze", "Tin", "Lead", "Coal", "Oil",
  "Sand", "Clay", "Dirt", "Mud", "Gravel", "Flint", "Quartz", "Marble", "Granite", "Limestone",
  "Amber", "Ivory", "Ebony", "Crystal", "Pearl", "Opal", "Topaz", "Garnet", "Amethyst", "Diamond",
  "Ruby", "Sapphire", "Emerald", "Jade", "Coral", "Shell", "Timber", "Lumber", "Bark", "Leaf",

  // Animals that appear in toponyms (~40)
  "Beaver", "Fox", "Bear", "Wolf", "Eagle", "Hawk", "Deer", "Elk", "Moose", "Otter",
  "Badger", "Coyote", "Rabbit", "Squirrel", "Owl", "Raven", "Crow", "Dove", "Swan", "Duck",
  "Goose", "Heron", "Crane", "Falcon", "Robin", "Sparrow", "Trout", "Salmon", "Bass", "Pike",
  "Lion", "Tiger", "Panther", "Leopard", "Jaguar", "Elephant", "Buffalo", "Bison", "Antelope", "Puma",

  // Settlement and infrastructure (~40)
  "Mill", "Bridge", "Fort", "Port", "Station", "Junction", "Crossing", "Farm", "Ranch", "Village",
  "Town", "City", "Borough", "District", "Plaza", "Square", "Heights", "Acres", "Estates", "Park",
  "Haven", "Harbor", "Bay", "Point", "Center", "Corner", "Gap", "Pass", "Fork", "Bend",
  "Tower", "Spire", "Dome", "Arch", "Gate", "Wall", "Road", "Trail", "Path", "Way",

  // Common surnames and personal names (~170)
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
  "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes",
  "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper",
  "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
  "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
  "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez",
  "Powell", "Jenkins", "Perry", "Russell", "Sullivan", "Bell", "Coleman", "Butler", "Henderson", "Barnes",
  "Gonzales", "Fisher", "Vasquez", "Simmons", "Romero", "Jordan", "Patterson", "Alexander", "Hamilton", "Graham",
  "Reynolds", "Griffin", "Wallace", "Moreno", "West", "Cole", "Hayes", "Bryant", "Herrera", "Gibson",
  "Ellis", "Tran", "Medina", "Aguilar", "Stevens", "Murray", "Ford", "Castro", "Marshall", "Owens",
  "Harrison", "Fernandez", "Mcdonald", "Woods", "Washington", "Kennedy", "Wells", "Vargas", "Henry", "Chen",
  "Freeman", "Webb", "Tucker", "Guzman", "Burns", "Crawford", "Olson", "Simpson", "Porter", "Hunter",
  "Gordon", "Mendez", "Silva", "Shaw", "Snyder", "Mason", "Dixon", "Munoz", "Hunt", "Hicks",
  "Holmes", "Palmer", "Wagner", "Black", "Robertson", "Boyd", "Rose", "Stone", "Salazar", "Fox",
  "Warren", "Mills", "Meyer", "Rice", "Schmidt", "Garza", "Daniels", "Ferguson", "Nichols", "Stephens",
  "Soto", "Weaver", "Ryan", "Gardner", "Payne", "Grant", "Dunn", "Kelley", "Spencer", "Hawkins",
  "Arnold", "Pierce", "Vazquez", "Hansen", "Peters", "Santos", "Hart", "Bradley", "Knight", "Elliott",
  "Cunningham", "Duncan", "Armstrong", "Hudson", "Carroll", "Lane", "Riley", "Andrews", "Alvarado", "Ray",
  "Delgado", "Berry", "Perkins", "Hoffman", "Johnston", "Matthews", "Pena", "Richards", "Contreras", "Willis",
  "Carpenter", "Lawrence", "Sandoval", "Guerrero", "George", "Chapman", "Rios", "Estrada", "Ortega", "Watkins",
  "Greene", "Nunez", "Wheeler", "Valdez", "Harper", "Burke", "Larson", "Santiago", "Maldonado", "Morrison",
  "Franklin", "Carlson", "Austin", "Dominguez", "Carr", "Lawson", "Jacobs", "Obrien", "Lynch", "Singh",
  "Vega", "Bishop", "Montgomery", "Oliver", "Jensen", "Harvey", "Williamson", "Gilbert", "Dean", "Sims",
  "Espinoza", "Howell", "Li", "Wong", "Reid", "Hanson", "Le", "Mccoy", "Garrett", "Burton",
  "Fuller", "Wang", "Weber", "Welch", "Rojas", "Lucas", "Marquez", "Fields", "Park", "Yang",
  "Little", "Banks", "Padilla", "Day", "Lincoln", "Jefferson", "Madison", "Monroe", "Hamilton", "Adams",
  "Jackson", "Columbus", "Clinton", "Grant", "Sherman", "Lee", "Davis", "Taylor", "Wilson", "Brown"
];

const adjectives = [
  "Red", "Blue", "Green", "White", "Black", "Golden", "Silver", "Copper", "Iron", "Amber",
  "Big", "Little", "Great", "Small", "High", "Low", "Upper", "Lower", "Long", "Short",
  "Rocky", "Sandy", "Muddy", "Clear", "Deep", "Dry", "Wet", "Flat", "Rough", "Smooth",
  "Fair", "Grand", "Pleasant", "Hidden", "Lost", "Old", "New", "Bright", "Dark", "Cold",
  "Hot", "Cool", "Warm", "Soft", "Hard", "Sharp", "Blunt", "Round", "Square", "Broad",
  "Narrow", "Wide", "Steep", "Gentle", "Wild", "Quiet", "Calm", "Stormy", "Sunny", "Cloudy",
  "Windy", "Still", "Open", "Closed", "Near", "Far", "East", "West", "North", "South",
  "Central", "Middle", "Outer", "Inner", "Rising", "Falling", "Standing", "Flowing", "Running", "Burning",
  "Frozen", "Thawing", "Blooming", "Fading", "Ancient", "Modern", "Young", "Aged", "Fresh", "Stale"
];

const prefixes = [
  "New ", "Old ", "Middle ", "Upper ", "Lower ", "East ", "West ", "North ", "South ",
  "Great ", "Little ", "Big ", "Small ", "Fort ", "Port ", "Lake ", "Mount ", "Saint ",
  "San ", "Los ", "El ", "La ", "Green ", "Red ", "White ", "Black ", "Blue ", "Silver ",
  "Golden ", "Rocky ", "Sandy ", "Muddy ", "Clear ", "Deep ", "High ", "Low ", "Long ",
  "Short ", "Broad ", "Narrow ", "Cold ", "Hot ", "Dry ", "Wet ", "Fair ", "Grand ",
  "Royal ", "Kings ", "Queens ", "Castle ", "Bridge ", "Mill ", "Oak ", "Pine ", "River ",
  "Stone ", "Iron ", "Copper ", "Gold ", "Silver ", "Ancient ", "Hidden ", "Lost ", "Secret "
];

const endings = [
  "ville", "town", "burg", "ton", "ham", "ford", "port", "land", "field", "wood",
  "dale", "shire", "chester", "minster", "bridge", "falls", "springs", "creek", "brook", "lake",
  "hill", "view"
];

const suffixWords = [
  "City", "Town", "Village", "Heights", "Acres", "Estates", "Park",
  "Haven", "Harbor", "Bay", "Point", "Beach", "Island", "Rock", "Stone", "Cliff",
  "Bluff", "Mesa", "Canyon", "Gulch", "Hollow", "Glen", "Meadow", "Prairie", "Plains",
  "Desert", "Oasis", "Spring", "Well", "Mill", "Station", "Junction", "Crossing",
  "Pass", "Gap", "Fork", "Bend", "Corner", "Center", "Plaza", "Square", "Forest",
  "Grove", "Wood", "Ridge", "Peak", "Valley", "Plain"
];

// legacy combined list kept for export compatibility
const suffixes = [...endings, ...suffixWords.map(s => " " + s)];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanName(name) {
  return name.replace(/\s+/g, " ").trim();
}

const patterns = [
  // occasional short ending (Springfield style)
  () => randomFrom(nouns) + randomFrom(endings),
  // noun + spaced word
  () => randomFrom(nouns) + " " + randomFrom(suffixWords),
  // prefix + noun
  () => randomFrom(prefixes) + randomFrom(nouns),
  // prefix + noun + spaced word
  () => randomFrom(prefixes) + randomFrom(nouns) + " " + randomFrom(suffixWords),
  // adjective + noun
  () => randomFrom(adjectives) + " " + randomFrom(nouns),
  // adjective + noun + spaced word
  () => randomFrom(adjectives) + " " + randomFrom(nouns) + " " + randomFrom(suffixWords),
  // prefix + adjective + noun
  () => randomFrom(prefixes) + randomFrom(adjectives) + " " + randomFrom(nouns),
  // noun + " " + noun
  () => randomFrom(nouns) + " " + randomFrom(nouns),
  // adjective + noun + " " + noun
  () => randomFrom(adjectives) + " " + randomFrom(nouns) + " " + randomFrom(nouns),
  // prefix + noun + short ending (rarer)
  () => Math.random() < 0.3 ? randomFrom(prefixes) + randomFrom(nouns) + randomFrom(endings) : randomFrom(prefixes) + randomFrom(nouns) + " " + randomFrom(suffixWords)
];

function generateCityName() {
  const pattern = randomFrom(patterns);
  let name = pattern();
  return cleanName(name);
}

// Example usage
// for (let i = 0; i < 20; i++) console.log(generateCityName());

if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateCityName, nouns, adjectives, prefixes, suffixes, endings, suffixWords };
}
