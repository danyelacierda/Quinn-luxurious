import {
  Clock,
  ShieldCheck,
  HeartHandshake,
  Award,
} from "lucide-react";

export const siteConfig = {
  name: "Quinn Luxurious",
  tagline: "Beauty, Refined.",
  description:
    "A boutique beauty studio for lash, brow, and nail artistry — where every appointment is unhurried, precise, and entirely yours.",
  phone: "+63 (938) 894-4690",
  email: "danielle.acierda@urios.edu.ph",
  address: "Butuan City, Purok - Magdamayan, Agusan del Norte, Philippines",
};

export const navLinks = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const businessHours = [
  { day: "Monday – Friday", hours: "9:00 AM – 7:00 PM" },
  { day: "Saturday", hours: "9:00 AM – 6:00 PM" },
  { day: "Sunday", hours: "11:00 AM – 4:00 PM" },
];

export const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/danielleacierda/" },
  { label: "Facebook", href: "https://www.facebook.com/daniellerey69" },
  { label: "TikTok", href: "https://www.tiktok.com/@tobirama_senju47?lang=en-GB" },
];



export const whyChooseUs = [
  {
    icon: Award,
    title: "Master Artistry",
    description:
      "Every technician is certified and trained in the latest lash and nail techniques.",
  },
  {
    icon: ShieldCheck,
    title: "Premium, Safe Products",
    description:
      "We use hypoallergenic, medical-grade adhesives and cosmetics for sensitive skin.",
  },
  {
    icon: Clock,
    title: "Unhurried Appointments",
    description:
      "Generous time is built into every booking so your service is never rushed.",
  },
  {
    icon: HeartHandshake,
    title: "Personalized Care",
    description:
      "A private consultation before every visit ensures the look is entirely yours.",
  },
];

export const testimonials = [
  {
    name: "Ariana M.",
    service: "Volume Lash Extensions",
    quote:
      "The most relaxing, precise lash appointment I've had. My set looked natural for weeks.",
    rating: 5,
  },
  {
    name: "Priya K.",
    service: "Gel Extensions & Nail Art",
    quote:
      "Quinn Luxurious is my monthly ritual now. The attention to detail on my nail art is unmatched.",
    rating: 5,
  },
  {
    name: "Sofia R.",
    service: "Lash Lift",
    quote:
      "Effortless mornings ever since. The studio feels like a private retreat, not a salon chain.",
    rating: 5,
  },
];
