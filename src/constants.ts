import { 
  Star, 
  Sun, 
  Moon, 
  Sparkles, 
  Zap, 
  Shield, 
  Heart, 
  Briefcase, 
  Activity, 
  DollarSign, 
  User,
  Video,
  Phone
} from "lucide-react";

export const ASTROLOGERS = [
  {
    id: "1",
    name: "Acharya Vashishtha",
    experience: "25 Years",
    specialization: "Vedic & KP Astrology",
    rating: 4.9,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=astro1"
  },
  {
    id: "2",
    name: "Pandit Suresh Sharma",
    experience: "15 Years",
    specialization: "Palmistry & Vastu",
    rating: 4.8,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=astro2"
  },
  {
    id: "3",
    name: "Dr. Anjali Verma",
    experience: "12 Years",
    specialization: "Gemology & Numerology",
    rating: 4.7,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=astro3"
  },
  {
    id: "4",
    name: "Guru Rajeshwar",
    experience: "30 Years",
    specialization: "Lalkitab & Remedies",
    rating: 5.0,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=astro4"
  },
  {
    id: "5",
    name: "Jyotishi Meenakshi",
    experience: "10 Years",
    specialization: "Prashna Kundli",
    rating: 4.6,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=astro5"
  },
  {
    id: "6",
    name: "Pt. Ram Krishna",
    experience: "20 Years",
    specialization: "Nadi Astrology",
    rating: 4.8,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=astro6"
  }
];

export const ZODIAC_DATA: Record<string, { icon: any; color: string; symbol: string }> = {
  Aries: { icon: "♈", symbol: "Ram", color: "from-red-500 to-orange-500" },
  Taurus: { icon: "♉", symbol: "Bull", color: "from-green-500 to-emerald-500" },
  Gemini: { icon: "♊", symbol: "Twins", color: "from-yellow-400 to-amber-500" },
  Cancer: { icon: "♋", symbol: "Crab", color: "from-blue-400 to-indigo-500" },
  Leo: { icon: "♌", symbol: "Lion", color: "from-orange-400 to-amber-600" },
  Virgo: { icon: "♍", symbol: "Virgin", color: "from-emerald-400 to-teal-500" },
  Libra: { icon: "♎", symbol: "Scales", color: "from-pink-400 to-rose-500" },
  Scorpio: { icon: "♏", symbol: "Scorpion", color: "from-purple-500 to-red-600" },
  Sagittarius: { icon: "♐", symbol: "Archer", color: "from-blue-500 to-purple-600" },
  Capricorn: { icon: "♑", symbol: "Goat", color: "from-slate-500 to-gray-700" },
  Aquarius: { icon: "♒", symbol: "Water Bearer", color: "from-cyan-400 to-blue-500" },
  Pisces: { icon: "♓", symbol: "Fish", color: "from-indigo-400 to-purple-500" }
};

export const HOROSCOPE_SECTIONS = [
  { id: "career", icon: Briefcase, label: "Career", color: "text-blue-400" },
  { id: "love", icon: Heart, label: "Love", color: "text-rose-400" },
  { id: "health", icon: Activity, label: "Health", color: "text-emerald-400" },
  { id: "finance", icon: DollarSign, label: "Finance", color: "text-amber-400" },
];
