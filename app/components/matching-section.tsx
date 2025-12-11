import { useState } from "react";
import { Heart, MapPin, Shuffle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";

interface Profile {
  id: number;
  name: string;
  age: number;
  distance: string;
  image: string;
  interests: string[];
  bio: string;
  compatibility: number;
  likes: number;
  isOnline?: boolean;
}

const allProfiles: Profile[] = [
  {
    id: 1,
    name: "Belle Benson",
    age: 28,
    distance: "1.5 km away",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=300&fit=crop&crop=face",
    interests: ["Music", "Cooking", "Swimming"],
    bio: "Love music, cooking, swimming, going out, travelling etc. Wanna be friends??",
    compatibility: 95,
    likes: 55,
    isOnline: true,
  },
  {
    id: 2,
    name: "Ruby Diaz",
    age: 33,
    distance: "1.3 km away",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop&crop=face",
    interests: ["Photography", "Art", "Coffee"],
    bio: "Artist and photographer. Love capturing beautiful moments and sharing stories over coffee.",
    compatibility: 92,
    likes: 91,
    isOnline: false,
  },
  {
    id: 3,
    name: "Myley Corbyn",
    age: 23,
    distance: "1.5 km away",
    image:
      "https://images.pexels.com/photos/31853094/pexels-photo-31853094.jpeg?w=400&h=300&fit=crop&crop=face",
    interests: ["Dancing", "Fitness", "Movies"],
    bio: "Dancer and fitness enthusiast. Always up for adventures and trying new things!",
    compatibility: 89,
    likes: 49,
    isOnline: true,
  },
  {
    id: 4,
    name: "Tony Z",
    age: 25,
    distance: "2 km away",
    image:
      "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&h=300&fit=crop&crop=face",
    interests: ["Gaming", "Tech", "Sports"],
    bio: "Tech enthusiast and gamer. Love sports and discovering new music genres.",
    compatibility: 87,
    likes: 29,
    isOnline: false,
  },
  {
    id: 5,
    name: "Emma",
    age: 25,
    distance: "2.5 km away",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=300&fit=crop&crop=face",
    interests: ["Photography", "Travel", "Coffee"],
    bio: "Adventure seeker and coffee enthusiast",
    compatibility: 95,
    likes: 82,
    isOnline: true,
  },
  {
    id: 6,
    name: "Sophie",
    age: 28,
    distance: "1.8 km away",
    image:
      "https://images.pexels.com/photos/31853088/pexels-photo-31853088.jpeg?w=400&h=300&fit=crop&crop=face",
    interests: ["Yoga", "Books", "Art"],
    bio: "Mindful living and creative soul",
    compatibility: 92,
    likes: 67,
    isOnline: true,
  },
  {
    id: 7,
    name: "Maya",
    age: 26,
    distance: "3.2 km away",
    image:
      "https://images.pexels.com/photos/157606/girl-black-dress-portrait-hair-157606.jpeg?w=400&h=300&fit=crop&crop=face",
    interests: ["Music", "Dancing", "Food"],
    bio: "Music lover and foodie explorer",
    compatibility: 89,
    likes: 73,
    isOnline: false,
  },
  {
    id: 8,
    name: "Zoe",
    age: 24,
    distance: "4.1 km away",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=300&fit=crop&crop=face",
    interests: ["Fitness", "Movies", "Tech"],
    bio: "Tech enthusiast and fitness lover",
    compatibility: 87,
    likes: 41,
    isOnline: true,
  },
];

export function MatchingSection() {
  const [lookingFor, setLookingFor] = useState("All");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("50");
  const [isScanning, setIsScanning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [matches, setMatches] = useState<Profile[]>([]);

  const handleSearch = () => {
    setIsScanning(true);
    setShowResults(false);

    // Simulate scanning effect
    setTimeout(() => {
      const filteredProfiles = allProfiles
        .filter((profile) => {
          const ageInRange =
            profile.age >= Number.parseInt(minAge) &&
            profile.age <= Number.parseInt(maxAge);
          return ageInRange;
        })
        .sort((a, b) => b.compatibility - a.compatibility)
        .slice(0, 8); // Show 8 profiles

      setMatches(filteredProfiles);
      setIsScanning(false);
      setShowResults(true);
    }, 2500);
  };

  const handleRandomAgain = () => {
    const shuffled = [...allProfiles]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
    setMatches(shuffled);
  };

  const handleProfileClick = (profile: Profile) => {
    console.log(`Clicked on ${profile.name}`);
  };

  return (
    <section className="py-10 sm:py-20 px-4 relative overflow-hidden bg-background font-serif">
      <div className="relative z-10 max-w-7xl mx-auto leading-3">
        {!isScanning && !showResults && (
          <>
            <div className="text-center mb-12 leading-3">
              <h2 className="text-3xl sm:text-7xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-6 font-serif">
                Find Match Now!
              </h2>
              <p className="text-lg text-foreground font-light max-w-2xl mx-auto">
                Where Connections Blossom! Your perfect match is just a click
                away.
              </p>
            </div>

            <div className="bg-card/80 backdrop-blur-md rounded-2xl p-8 max-w-5xl mx-auto border border-border shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="md:col-span-1">
                  <label className="block text-foreground text-sm font-light mb-3">
                    Looking for
                  </label>
                  <Select value={lookingFor} onValueChange={setLookingFor}>
                    <SelectTrigger className="bg-background rounded-full h-14 text-foreground font-medium px-6 w-full border-pink-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="Women">Women</SelectItem>
                      <SelectItem value="Men">Men</SelectItem>
                      <SelectItem value="Non-binary">Non-binary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-foreground text-sm font-light mb-3">
                    Min Age
                  </label>
                  <Select value={minAge} onValueChange={setMinAge}>
                    <SelectTrigger className="bg-background rounded-full h-14 text-foreground font-medium px-6 w-full border-pink-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 63 }, (_, i) => i + 18).map(
                        (age) => (
                          <SelectItem key={age} value={age.toString()}>
                            {age} years old
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-foreground text-sm font-light mb-3">
                    Max Age
                  </label>
                  <Select value={maxAge} onValueChange={setMaxAge}>
                    <SelectTrigger className="bg-background rounded-full h-14 text-foreground font-medium px-6 w-full border-pink-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 63 }, (_, i) => i + 18).map(
                        (age) => (
                          <SelectItem key={age} value={age.toString()}>
                            {age} years old
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-1">
                  <Button
                    size="lg"
                    onClick={handleSearch}
                    disabled={isScanning}
                    className="w-auto bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium shadow-xl hover:shadow-pink-500/25 transition-all duration-300 transform hover:scale-105 border-0 rounded-lg"
                  >
                    Search
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
        {isScanning && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <style>{`
              @keyframes loading-dots {
                0%, 20% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.5); opacity: 0.7; }
                80%, 100% { transform: scale(1); opacity: 1; }
              }
            `}</style>

            <div className="text-center space-y-6">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                Scanning for Matches
              </h3>
              <p className="text-muted-foreground text-lg">
                Analyzing compatibility patterns...
              </p>
            </div>

            <div className="flex space-x-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-full bg-gradient-to-r from-pink-400 to-rose-500"
                  style={{
                    width:
                      i === 2 ? "16px" : i === 1 || i === 3 ? "12px" : "8px",
                    height:
                      i === 2 ? "16px" : i === 1 || i === 3 ? "12px" : "8px",
                    animation: `loading-dots 1.5s ease-in-out infinite ${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {showResults && matches.length > 0 && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {matches.map((profile, index) => (
                <div
                  key={profile.id}
                  onClick={() => handleProfileClick(profile)}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <img
                    src={
                      profile.image ||
                      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=300&fit=crop&crop=face"
                    }
                    alt={profile.name}
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-pink-900/50 via-pink to-transparent"></div>

                  {profile.isOnline && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full shadow-lg animate-ping"></div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <div className="flex items-end justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold mb-1 truncate">
                          {profile.name}, {profile.age}
                        </h3>
                        <div className="flex items-center text-xs text-white/90">
                          <MapPin className="w-2.5 h-2.5 mr-1 flex-shrink-0" />
                          <span className="truncate">{profile.distance}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5 ml-2">
                        <Heart className="w-2.5 h-2.5 text-white fill-current" />
                        <span className="text-xs font-medium">
                          {profile.likes}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center space-x-4">
              <Button
                onClick={handleRandomAgain}
                className="text-primary bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 px-6 py-3 rounded-full font-light shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Random Again
              </Button>
              <Button
                onClick={() => setShowResults(false)}
                className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white px-6 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                New Search
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
