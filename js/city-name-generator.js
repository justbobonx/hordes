// City Name Generator
// Generates random city/town names by picking a pattern then combining lists.
// Prefixes and some suffixes include leading/trailing spaces as specified.

const nouns = [
  "Beaver", "Fox", "Bear", "Wolf", "Eagle", "Hawk", "Deer", "Elk", "Moose", "Otter",
  "Badger", "Coyote", "Rabbit", "Squirrel", "Owl", "Raven", "Crow", "Dove", "Swan", "Duck",
  "Goose", "Heron", "Crane", "Falcon", "Robin", "Sparrow", "Trout", "Salmon", "Bass", "Pike",
  "Shark", "Whale", "Seal", "Walrus", "Lion", "Tiger", "Panther", "Leopard", "Cheetah", "Jaguar",
  "Elephant", "Rhino", "Hippo", "Giraffe", "Zebra", "Monkey", "Ape", "Gorilla", "Kangaroo", "Koala",
  "Panda", "Penguin", "Anchor", "Beacon", "Bridge", "Castle", "Chapel", "Church", "Cross", "Crown",
  "Mill", "Factory", "Mine", "Quarry", "Farm", "Ranch", "Station", "Junction", "Crossing", "Pass",
  "Gap", "Fork", "Bend", "Corner", "Center", "Plaza", "Square", "Heights", "Acres", "Estates",
  "Village", "Town", "City", "Borough", "District", "Fort", "Port", "Harbor", "Dock", "Pier",
  "Wharf", "Lighthouse", "Tower", "Spire", "Dome", "Arch", "Gate", "Wall", "Fence", "Road",
  "Trail", "Path", "Way", "Street", "Avenue", "Boulevard", "Oak", "Pine", "Maple", "Cedar",
  "Elm", "Willow", "Ash", "Birch", "Spruce", "Fir", "Cypress", "Redwood", "Sequoia", "Poplar",
  "Aspen", "Hickory", "Walnut", "Chestnut", "Alder", "Beech", "Sycamore", "Magnolia", "Dogwood", "Holly",
  "Ivy", "Moss", "Fern", "Reed", "Cane", "Palm", "River", "Lake", "Hill", "Mountain",
  "Valley", "Ridge", "Peak", "Creek", "Brook", "Spring", "Falls", "Pond", "Marsh", "Swamp",
  "Desert", "Canyon", "Gulch", "Hollow", "Glen", "Meadow", "Prairie", "Plain", "Forest", "Grove",
  "Wood", "Park", "Haven", "Bay", "Point", "Beach", "Island", "Rock", "Stone", "Cliff",
  "Bluff", "Mesa", "Butte", "Plateau", "Delta", "Inlet", "Sound", "Strait", "Cape", "Head",
  "Iron", "Copper", "Gold", "Silver", "Steel", "Bronze", "Tin", "Lead", "Coal", "Oil",
  "Sand", "Clay", "Dirt", "Mud", "Gravel", "Flint", "Quartz", "Marble", "Granite", "Limestone",
  "Red", "Blue", "Green", "Black", "White", "Yellow", "Orange", "Purple", "Brown", "Gray",
  "Pink", "Amber", "Ivory", "Ebony", "Scarlet", "Crimson", "Azure", "Emerald", "Jade", "Ruby",
  "Sapphire", "Diamond", "Crystal", "Pearl", "Opal", "Topaz", "Garnet", "Amethyst", "Quartz", "Flint",
  "Miller", "Baker", "Smith", "Cooper", "Taylor", "Wright", "Fisher", "Hunter", "Shepherd", "Farmer",
  "Miner", "Sailor", "Pilot", "Doctor", "Teacher", "Priest", "King", "Queen", "Prince", "Lord",
  "Lady", "Baron", "Earl", "Duke", "Knight", "Squire", "Page", "Herald", "Scout", "Ranger",
  "Pioneer", "Settler", "Founder", "Builder", "Maker", "Weaver", "Potter", "Carpenter", "Mason", "Blacksmith",
  "Goldsmith", "Silversmith", "Coppersmith", "Tinsmith", "Locksmith", "Gunsmith", "Wheelwright", "Shipwright", "Cartwright", "Plowwright",
  "Anchor", "Beacon", "Signal", "Light", "Flame", "Fire", "Smoke", "Ash", "Ember", "Spark",
  "Storm", "Thunder", "Lightning", "Rain", "Snow", "Ice", "Frost", "Dew", "Mist", "Fog",
  "Wind", "Breeze", "Gale", "Tempest", "Hurricane", "Tornado", "Cyclone", "Whirlwind", "Dust", "Sandstorm",
  "Sunrise", "Sunset", "Dawn", "Dusk", "Noon", "Midnight", "Twilight", "Star", "Moon", "Sun",
  "Comet", "Meteor", "Planet", "Galaxy", "Nebula", "Constellation", "Orbit", "Eclipse", "Solstice", "Equinox",
  "Hope", "Faith", "Charity", "Peace", "Justice", "Liberty", "Freedom", "Independence", "Unity", "Harmony",
  "Prosperity", "Fortune", "Luck", "Destiny", "Fate", "Victory", "Triumph", "Glory", "Honor", "Valor",
  "Courage", "Bravery", "Wisdom", "Knowledge", "Truth", "Beauty", "Grace", "Mercy", "Kindness", "Joy",
  "Bliss", "Delight", "Pleasure", "Comfort", "Ease", "Rest", "Calm", "Quiet", "Silence", "Stillness"
];

const prefixes = [
  "New ", "Old ", "Middle ", "Upper ", "Lower ", "East ", "West ", "North ", "South ",
  "Great ", "Little ", "Big ", "Small ", "Fort ", "Port ", "Lake ", "Mount ", "Saint ",
  "San ", "Los ", "El ", "La ", "Green ", "Red ", "White ", "Black ", "Blue ", "Silver ",
  "Golden ", "Rocky ", "Sandy ", "Muddy ", "Clear ", "Deep ", "High ", "Low ", "Long ",
  "Short ", "Broad ", "Narrow ", "Cold ", "Hot ", "Dry ", "Wet ", "Fair ", "Grand ",
  "Royal ", "Kings ", "Queens ", "Castle ", "Bridge ", "Mill ", "Oak ", "Pine ", "River ",
  "Stone ", "Iron ", "Copper ", "Gold ", "Silver ", "Ancient ", "Modern ", "Future ", "Past ",
  "Hidden ", "Lost ", "Found ", "Secret ", "Open ", "Closed ", "Bright ", "Dark ", "Light ",
  "Heavy ", "Soft ", "Hard ", "Smooth ", "Rough ", "Sharp ", "Blunt ", "Round ", "Square ",
  "Triangular ", "Oval ", "Circular ", "Linear ", "Curved ", "Straight ", "Winding ", "Twisting ",
  "Rising ", "Falling ", "Standing ", "Sitting ", "Lying ", "Flying ", "Running ", "Walking ",
  "Swimming ", "Diving ", "Climbing ", "Descending ", "Ascending ", "Horizontal ", "Vertical "
];

const suffixes = [
  "ville", "town", "burg", "ton", "ham", "ford", "port", "land", "field", "wood",
  "dale", "shire", "chester", "minster", "bridge", "falls", "springs", "creek", "brook", "lake",
  "hill", "view", " City", " Town", " Village", " Heights", " Acres", " Estates", " Park",
  " Haven", " Harbor", " Bay", " Point", " Beach", " Island", " Rock", " Stone", " Cliff",
  " Bluff", " Mesa", " Canyon", " Gulch", " Hollow", " Glen", " Meadow", " Prairie", " Plains",
  " Desert", " Oasis", " Spring", " Well", " Mill", " Station", " Junction", " Crossing",
  " Pass", " Gap", " Fork", " Bend", " Corner", " Center", " Plaza", " Square", " Forest",
  " Grove", " Wood", " Ridge", " Peak", " Valley", " Plain", "burg", "ton", "ham", "ford",
  "port", "land", "field", "wood", "dale", "shire", "chester", "minster", "bridge", "falls",
  "springs", "creek", "brook", "lake", "hill", "view", " City", " Town", " Village", " Heights",
  " Acres", " Estates", " Park", " Haven", " Harbor", " Bay", " Point", " Beach", " Island",
  " Rock", " Stone", " Cliff", " Bluff", " Mesa", " Canyon", " Gulch", " Hollow", " Glen",
  " Meadow", " Prairie", " Plains", " Desert", " Oasis", " Spring", " Well", " Mill", " Station",
  " Junction", " Crossing", " Pass", " Gap", " Fork", " Bend", " Corner", " Center", " Plaza",
  " Square", " Forest", " Grove", " Wood", " Ridge", " Peak", " Valley", " Plain", "burg",
  "ton", "ham", "ford", "port", "land", "field", "wood", "dale", "shire", "chester",
  "minster", "bridge", "falls", "springs", "creek", "brook", "lake", "hill", "view"
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanName(name) {
  return name.replace(/\s+/g, " ").trim();
}

const patterns = [
  // [noun][suffix]
  () => randomFrom(nouns) + randomFrom(suffixes),
  // [prefix][noun]
  () => randomFrom(prefixes) + randomFrom(nouns),
  // [prefix][noun][suffix]
  () => randomFrom(prefixes) + randomFrom(nouns) + randomFrom(suffixes),
  // [noun] [noun][suffix]
  () => randomFrom(nouns) + " " + randomFrom(nouns) + randomFrom(suffixes),
  // [prefix][noun] [suffix word if space]
  () => randomFrom(prefixes) + randomFrom(nouns) + randomFrom(suffixes),
  // [noun][suffix] [City/Town etc already in suffixes]
  () => randomFrom(nouns) + randomFrom(suffixes)
];

function generateCityName() {
  const pattern = randomFrom(patterns);
  let name = pattern();
  return cleanName(name);
}

// Example usage (uncomment to test in console)
// console.log(generateCityName());
// for (let i = 0; i < 20; i++) console.log(generateCityName());

// Export for modules if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateCityName, nouns, prefixes, suffixes };
}
